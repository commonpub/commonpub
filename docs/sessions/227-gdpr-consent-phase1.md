# Session 227 — GDPR consent hardening, Phase 1 (SHIPPED)

Implemented Phase 1 of `docs/plans/gdpr-consent-hardening.md` (the plan + the email
plan + the analysis doc were authored this session — see below). Records site-wide
terms/CoC acceptance and completes the data export. Independent of the email work.

## What shipped — schema 0.50.0 / config 0.24.0 / server 2.96.0 / layer 0.86.9, migration 0035

### Schema (0.50.0, migration 0035, additive)
- New `user_consents` append-only audit table (`userId` cascade, `kind`, `version`,
  `documentHash`, `acceptedAt`, `ipAddress`, `userAgent`; index on `(userId, kind)`) —
  the instance-scoped analogue of `contest_agreement_acceptances`.
- `users.accepted_terms_at` + `users.accepted_terms_version` (denormalized "current
  acceptance" for cheap reads + a future re-acceptance gate).

### Config (0.24.0)
- `instance.termsVersion` (`z.string().default('1')`) — recorded against each
  acceptance; bump when the terms text changes materially.

### Server (2.96.0)
- `recordConsent(db, { userId, kind, version, documentHash?, ip?, userAgent? })` —
  appends a `user_consents` row; for `kind:'terms'` also sets the two `users` columns.
- `exportUserData` extended (GDPR Art. 20 completeness): added `consents`, `votes`,
  `hubMemberships`, `enrollments`, `events`, `eventRsvps`, `contestEntries`,
  `contestPersonalData` (the entrant's OWN partitioned PII), `contestAgreements`.
  These were omitted before, narrower than both the privacy policy and the deletion
  cascade.
- **Latent bug fixed:** the content export's tags subquery used a bare
  `${contentItems.id}` that renders as `"id"`, ambiguous against the joined `tags.id`
  (Postgres `42702`). It had no test and would error on real Postgres; now
  fully-qualified. Surfaced by the new export test.

### Layer (0.86.9)
- Signup now records terms acceptance: the `onUserCreated` hook
  (`server/middleware/auth.ts`) calls `recordConsent(kind:'terms',
  version: config.instance.termsVersion)`, best-effort + isolated so it can't break
  registration.
- `pages/auth/register.vue`: the passive "by signing up you agree" text is now a
  **required acceptance checkbox** (affirmative consent). The Create-account button is
  disabled until ticked; a defensive `handleSubmit` guard blocks programmatic submits.

## Tests
- Server (+3, suite **1501**): `recordConsent` writes the row + sets the user columns
  for `terms`; a non-terms (`cookies`) consent does NOT touch the terms columns; export
  includes all new sections + the recorded consent
  (`__tests__/consent-export.integration.test.ts`).
- Layer (+2, suite **1412**): the submit button is disabled until the checkbox is
  ticked, and `signUp` isn't called while unchecked (`components/__tests__/
  registerConsent.test.ts`). Full `pnpm typecheck` **28/28**.
- **Live** (docker pg :5433 + nuxt dev, real signup): a new account creates a
  `user_consents` row (kind=terms, v=1) + sets `users.accepted_terms_at/version`;
  `/api/auth/export-data` returns 200 with `consents` populated + all new keys present;
  register page screenshot verified (checkbox + linked terms/privacy, button
  disabled→enabled).

## Release / roll
- Published schema 0.50.0 → config 0.24.0 → server 2.96.0 → layer 0.86.9 (layer pins
  schema 0.50.0 / server 2.96.0). Migration 0035 committed; applies via the deploy
  `db-migrate.mjs` path. PR to main → commonpub.io. deveco/heatsync: bump
  `@commonpub/{schema,config,server,layer}` pins + lockfiles → migration 0035 applies on
  deploy. Additive migration; no flags (the checkbox + recording are always-on).

## Decisions
- Audit **table** (not just two columns) — enables re-acceptance history + future
  cookie-consent records (Phase 2). Consent rows cascade-delete with the user
  (consistent with the existing erasure model).
- Acceptance recorded in the after-create hook (no client round-trip / failure window);
  the checkbox is the client-side affirmative gate.

## Also authored this session (planning deliverables)
- `docs/reference/email-gdpr-scaling-analysis.md` — the full investigation (consent,
  email pipeline, digests, admin broadcast, Resend spend, scaling capacity).
- `docs/plans/gdpr-consent-hardening.md` (this implements its Phase 1; Phase 2 =
  re-acceptance gate + logged-in cookie record, optional, not built).
- `docs/plans/email-comms-overhaul.md` — email send-path hardening (Postgres outbox,
  chosen) + unsubscribe + customizable templates + admin broadcast. Not built yet.

## Open / next
- GDPR Phase 2 (optional): `requireTermsAcceptance` flag + re-acceptance interstitial +
  logged-in cookie-consent server record.
- Email overhaul (`docs/plans/email-comms-overhaul.md`), starting Phase 1 (outbox +
  throttle/retry/batch + unsubscribe). Email is OFF on all 3 today.
- CLI `create-commonpub` pins are stale (still ^0.49/^2.95/^0.86.7/config ^0.23) — re-pin
  to schema ^0.50 / config ^0.24 / server ^2.96 / layer ^0.86.9 on the next CLI bump.
