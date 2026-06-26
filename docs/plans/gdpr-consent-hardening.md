# Plan — GDPR / Consent Hardening

> **Status: COMPLETE (session 227).** Phase 1 (acceptance recording + signup checkbox + export
> completeness, migration 0035) and Phase 2 (re-acceptance gate + cookie record + server-side
> write-enforcement middleware) SHIPPED + ROLLED to all 3. `requireTermsAcceptance` flag default OFF.
> Detail: `docs/sessions/227-email-refactor-gdpr-phase2.md` + the GDPR-enforcement follow-up.

> Created 2026-06-25 (session 227). Companion analysis:
> `docs/reference/email-gdpr-scaling-analysis.md` §1. This plan closes the
> site-wide consent/terms gaps. It is INDEPENDENT of the email work
> (`docs/plans/email-comms-overhaul.md`) and can ship on its own. The per-email
> unsubscribe gap lives in the email plan (Phase 1b), not here.

## Context (current state)

- `/terms` (Community Terms + Code of Conduct), `/privacy`, `/cookies` pages exist,
  footer-linked, config-templated per instance.
- Cookie banner (`CookieConsent.vue`) shows only if a non-essential cookie is
  registered; stock instances are essential-only so it never shows (defensible).
  Choice lives only in the `cpub-consent` browser cookie — no server record.
- Signup (`layers/base/pages/auth/register.vue`) shows passive text "By creating an
  account, you agree…" with **no checkbox and no acceptance recorded**. The `users`
  table (`packages/schema/src/auth.ts:5`) has no consent columns.
- `exportUserData` (`packages/server/src/profile/export.ts`) omits hub memberships,
  learning enrollments, events/RSVPs, votes, contest entries, contest PII, agreement
  acceptances, and received messages — narrower than both the privacy policy and the
  deletion cascade.
- The only real consent audit trail today is contest-scoped
  (`contest_agreement_acceptances`, with terms snapshot + sha-256 + ip).

## Goals

1. Record site-wide terms/CoC acceptance (who, when, which version) with an audit trail.
2. Make signup an explicit affirmative act (required checkbox), not passive notice.
3. Complete the data export to match the privacy policy + the deletion cascade.
4. (Optional, flagged) Require re-acceptance when the terms version is bumped.
5. (Optional) Persist a server-side cookie-consent record for logged-in users.

## Non-goals

- Per-email unsubscribe (that is email Phase 1b).
- A consent-management platform / granular per-purpose toggles beyond essential vs
  functional vs analytics (the cookie registry already models categories).
- Re-architecting the cookie banner; it stays as-is (Goal 5 only adds a server record).

## Design

### Schema (migration NNNN, additive)

A dedicated append-only audit table is the recommended approach — it handles
re-acceptance history and cookie consent, and mirrors `contest_agreement_acceptances`:

```ts
// packages/schema/src/auth.ts (or a new consent.ts re-exported from index)
export const userConsents = pgTable('user_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 32 }).notNull(), // 'terms' | 'code_of_conduct' | 'privacy' | 'cookies'
  version: varchar('version', { length: 32 }).notNull(),
  documentHash: varchar('document_hash', { length: 64 }), // sha-256 of rendered text; reuse hashTerms()
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
}, (t) => [index('idx_user_consents_user_kind').on(t.userId, t.kind)]);
```

Plus two denormalized columns on `users` for cheap "current acceptance" reads + the
re-acceptance gate (avoids a join on every request):

```ts
acceptedTermsAt: timestamp('accepted_terms_at', { withTimezone: true }),
acceptedTermsVersion: varchar('accepted_terms_version', { length: 32 }),
```

Extend `users.emailNotifications` typing is NOT needed here (that's the email plan).

> Cascade note: `onDelete: 'cascade'` means consent rows are erased with the user
> (consistent with the existing deletion model). If retaining proof-of-consent
> post-deletion is desired for legal defensibility, switch to `set null` + anonymize
> — call this out as a decision (see Open decisions).

### Config (`packages/config`)

- `instance.termsVersion: z.string().default('1')` — operator bumps when terms text
  changes materially. Drives the recorded `version` + the re-acceptance gate.
- `features.requireTermsAcceptance: z.boolean().default(false)` (CLAUDE.md rule 2) —
  gates the re-acceptance interstitial (Phase 2).

### Server (`@commonpub/server`)

- `recordConsent(db, { userId, kind, version, documentHash?, ip?, userAgent? })` —
  inserts a `user_consents` row; for `kind:'terms'` also updates the two `users`
  columns. Idempotent-ish (a new row per acceptance is fine; it's an audit log).
- Reuse `hashTerms()` (already in the contest module) for `documentHash`.
- Extend `exportUserData` (`profile/export.ts`) to add: hub memberships, learning
  enrollments, events + RSVPs, votes, contest entries (+ the user's OWN contest PII
  and agreement acceptances), received messages, and `user_consents`. Each is an
  additive `db.select` keyed by `userId` — follow the existing section pattern.

### Auth wiring (where acceptance is captured)

Better Auth's sign-up/email runs in `layers/base/server/middleware/auth.ts`. Two viable
hooks; recommended = the existing `databaseHooks` in `packages/auth/src/createAuth.ts`
(`onUserCreated` after-create already fires):

- The register form (`auth/register.vue`) adds a **required** unchecked checkbox: "I
  agree to the Terms of Service and Code of Conduct" (links to `/terms`). Submit is
  blocked until checked (client gate = the affirmative act).
- On successful user creation, the after-create hook calls `recordConsent` with
  `kind:'terms'` + `version: config.termsVersion`. IP/userAgent from the better-auth
  request context if reachable there; otherwise omit (terms proof doesn't require IP
  the way the contest agreement does). This guarantees every new account has a recorded
  acceptance, with no race window.
- Fallback if the hook can't see the request: a client `POST /api/consent` immediately
  after the auto-sign-in, recording with the request IP. (The hook approach is
  preferred — no failure window.)

### Phase 2 (optional, flagged): re-acceptance + cookie record

- When `features.requireTermsAcceptance` is on AND `users.acceptedTermsVersion <
  config.termsVersion`, a middleware/layout interstitial blocks app use until the user
  re-accepts → `POST /api/consent` → updates columns + new audit row.
- Cookie-consent server record: when a logged-in user clicks Accept/Essential in
  `useCookieConsent`, also `POST /api/consent` (`kind:'cookies'`, version from a
  `cookiePolicyVersion`). Anonymous users keep the cookie-only mechanism.

## Phases / sequencing

- **Phase 1 (core, ship first):** schema migration + `recordConsent` + signup checkbox
  + after-create hook recording + export completeness + `termsVersion` config. This
  closes gaps #1, #2, #5 from the analysis.
- **Phase 2 (optional):** `requireTermsAcceptance` flag + re-acceptance interstitial +
  logged-in cookie-consent server record. Closes gaps #3, #6.

## Tests (TDD)

- Signup records a `user_consents` row + sets `users.acceptedTermsAt/Version`
  (integration, real PG).
- Export now includes each new section (hub memberships, enrollments, events, votes,
  own contest PII + agreements, received messages, consents).
- `recordConsent` writes hash + version correctly.
- Phase 2: re-acceptance gate blocks when version stale + clears after accept; flag-off
  is a no-op.
- Layer: register checkbox is required (submit disabled until checked); a11y on the
  checkbox + interstitial dialog.

## Release plan

One chain (Phase 1): bump `schema` (new table + columns + migration) → `config` (new
flag + termsVersion) → `server` (recordConsent + export) → `layer` (register checkbox).
Migration is additive. Per the runbook: publish in dep order, PR + squash-merge
(commonpub.io deploys), bump deveco/heatsync pins + lockfiles + CLI, curl-verify all 3.
Phase 2 is a second optional chain (config flag + layer interstitial; no schema change
beyond a `cookiePolicyVersion`).

## Open decisions (confirm before building)

1. **Audit table vs two columns only.** Recommended: the `user_consents` table (richer,
   enables re-acceptance + cookie records). Minimal alternative: just the two `users`
   columns (cheaper, no re-acceptance history).
2. **Consent rows on account deletion: cascade-erase (default, consistent) vs retain +
   anonymize for proof-of-consent.** Recommended: cascade now; revisit if legal needs
   post-deletion proof.
3. **Phase 2 scope** — build re-acceptance + cookie server-record now or defer.

## Effort estimate

Phase 1: ~1 focused session (1 migration, ~3 server fns/extensions, 1 form change,
tests). Phase 2: ~0.5 session.
