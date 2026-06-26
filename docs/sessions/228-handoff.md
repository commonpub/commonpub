# Session 228 — Handoff (state as of 2026-06-26)

Rolling "where things stand" after a long session 227 that delivered the **email &
communications overhaul** and the **GDPR consent** work end to end. Companion: the
canonical runbook `docs/STATUS.md` (versions, release chain, deploy, flags); the
kickoff prompt for the next agent is `docs/sessions/228-kickoff.md`.

## Published versions (all live on commonpub.io + deveco.io + heatsynclabs.io)
`schema 0.54.0 · config 0.26.0 · infra 0.13.0 · server 2.100.1 · layer 0.89.1`
(unchanged this arc: protocol 0.14.0, auth 0.8.0, ui 0.13.1, editor 0.9.0, docs 0.6.3,
learning 0.5.2, explainer 0.8.0, theme-studio 0.6.1, test-utils 0.5.8). Migrations through
**0037**. create-commonpub **0.5.20** on crates.io — **re-pinned to current** (schema ^0.54 /
config ^0.26 / server ^2.100.1 / layer ^0.89.1).

## GDPR Phase 2 enforcement follow-up (server 2.100.1 / layer 0.89.1)
An adversarial review of GDPR Phase 2 (no P0; auth/CSRF/IDOR/spoofing/injection all clean)
found the re-acceptance gate was client-side only. Added `layers/base/server/middleware/
require-terms.ts`: when `requireTermsAcceptance` is on, a logged-in user with a stale accepted
version gets **403 on WRITE `/api/*`** requests until they re-accept (reads + the gate stay
open; `/api/consent` + `/api/auth/*` exempt). Flag-gated → zero cost when off (the default).
Also: `recordConsent` dedups the audit insert on a same-version repeat (no unbounded
`user_consents` growth) while keeping `users.accepted_terms_*` in sync; `termsVersion` is
documented as an opaque, bump-forward-only token.

## What shipped this session (all SHIPPED + ROLLED to all 3)

### GDPR / consent (plan: `docs/plans/gdpr-consent-hardening.md` — COMPLETE)
- **Phase 1** (migration 0035): `user_consents` audit table + `users.accepted_terms_at/version`;
  `recordConsent` on signup via the `onUserCreated` hook; a **required acceptance checkbox**
  on the register page; `exportUserData` completed (consents/votes/hub-memberships/
  enrollments/events/RSVPs/contest-entries/own-PII/agreements); fixed a latent ambiguous-`id`
  bug in the content export. `instance.termsVersion` config.
- **Phase 2** (no migration): `requireTermsAcceptance` flag (default OFF), `POST /api/consent`
  + `GET /api/consent/status`, a `TermsReacceptanceGate` interstitial, and logged-in
  cookie-consent recording. `instance.cookiePolicyVersion` config.

### Email & comms (plan: `docs/plans/email-comms-overhaul.md` — COMPLETE)
- **Phase 1 + 1b** (migration 0036): the durable `email_outbox` + a throttled/batched/
  retrying drain worker (`drainEmailOutbox`, FOR UPDATE SKIP LOCKED, backoff, dead-letter)
  replacing the broken fire-one-fetch-per-recipient path; instant + digest now ENQUEUE;
  RFC 8058 unsubscribe (HMAC token, `unsubscribedAll` pref, `List-Unsubscribe` header +
  `/unsubscribe` page + `POST /api/unsubscribe`). Auth mail still sends directly.
- **Phase 2**: operator-customizable email branding (accent/header/logo/footer) in
  `instance_settings['email.branding']`, applied to ALL emails, with an `email.manage` admin
  editor (`/admin/email-templates`) + live preview.
- **Phase 3** (migration 0037): admin broadcast — compose + send to all / by-role / specific
  users via the outbox, recipients always verified + not-unsubscribed, confirm-before-send +
  audit history. `broadcast.send` permission + `adminBroadcast` flag (default OFF).
- **3 outbox audit fixes** (from adversarial reviews): per-message batch attribution (no
  silent loss on a partial Resend batch); cross-replica safety via per-chunk lock renewal of
  all in-flight rows + a 30s HTTP timeout + batchSize floor.
- **Maintainability refactor**: split the `infra/email.ts` monolith into
  `email/{types,adapters,render,templates}`; `buildUnsubscribeLinks` shared helper; deleted
  2 dead templates; extracted `notification/emailPrefs.ts`.

## IMPORTANT operational state
- **Email is OFF in production on all 3** (`emailNotifications=false`, adapter defaults to
  console, no deploy wires a Resend/SMTP secret). The outbox worker + all email features are
  **inert until an operator enables email**. So none of the email work changes prod behavior
  yet — turning it on is an operator decision (set `NUXT_EMAIL_ADAPTER=resend` +
  `NUXT_RESEND_API_KEY`/`NUXT_RESEND_FROM` + `NUXT_PUBLIC_FEATURES_EMAIL_NOTIFICATIONS=true`,
  verify a sending domain in Resend). `adminBroadcast` + `requireTermsAcceptance` also OFF.
- **New flag gotcha (learned the hard way):** a feature flag needs FOUR edits to be
  env-toggleable — `packages/config/src/{schema,types}.ts`, `layers/base/nuxt.config.ts`
  `runtimeConfig.public.features`, AND `apps/reference/server/utils/config.ts` `ENV_FLAG_MAP`
  (the env→`config.features` merge only iterates that map). The `/admin/features` DB-toggle
  works for ANY flag without ENV_FLAG_MAP. Also add it to `packages/test-utils/src/mockConfig.ts`
  + the `health.test.ts` FeatureFlags literal or the server build fails.

## Plans audit (session 228 — all 24 `docs/plans/` + 4 archived, verified vs STATUS + code)

**Complete (no outstanding code):** email-comms-overhaul, gdpr-consent-hardening,
rbac + rbac-activation-and-contest-editors, federation-discovery-and-hardening,
federation-hardening, public-api-cors-and-metrics (Ph1-3), pagination-scalability (A-C),
ALL six contest plans (stage-e-unification, stages-and-editor-polish, per-stage-submissions,
elevation, editor-shell, builder-ux), theme-studio-advanced-tokens (A-D), search-overhaul,
redis-integration (code done), and the 4 archived master/federation plans (historical).

**GENUINELY PENDING engineering (never built or partially built) — the real backlog:**
1. **Layout engine** (`layout-engine-rollout.md` + `phase-3-editor.md`) — the LARGEST. The
   visual editor is ~80% (Phase 3e-remainder: mobile colSpan slider, rich-field pickers,
   config-edit undo; Phase 3f inspector polish — both pending). The ROLLOUT (Phases 4-10) is
   largely unshipped: adopt `LayoutSlot` in ~7 more routes (currently homepage-only), the
   remaining ~8 section types, mobile editor, versioning/draft/publish UI. The engine is a
   **commonpub.io-only canary** — deveco/heatsync run the legacy renderer (`layoutEngine` OFF).
2. **instance-self-update.md** — ENTIRE feature un-built; status "awaiting maintainer approval."
   No backend, no `/admin/updates` page, no scaffolder workflow. A DECISION GATE, not just dev.
3. **monolith-splits Phases 3c / 4a / 4b** (`monolith-splits-remaining-backlog.md`):
   3c federated-follow-from-profile UI (backend ready; needs a UI surface + a decision);
   4a homepage 3-path consolidation (`pages/index.vue` still has 3 branches; HIGH blank-page
   risk, needs a 2-phase deploy seeding default layouts); 4b extract `inboxHandlers.onCreate`
   (file still ~1512 lines; needs inbound-Create integration tests first; HIGH risk).

**Deferred-by-design (logged optional, NOT action items):** pagination step D (unified
`feed_items`), public-API Phase 4 (event table), theme-studio Phase E, contest B3 teams,
federation small polish (txn-wrap approveMirror, backfill-progress UI). Redis + Meilisearch
are code-complete but **operator-deferred** (env vars unset; single-process + Postgres-FTS is
the live path).

**Operator actions (can't be done headlessly):** enable email (Resend secret); federation P3
mirror Offer→Accept live round-trip; `reconcile-counters --check`; RBAC flag-flip rollout.

**Doc hygiene:** three plan headers carried stale "pending release / NOT merged" text that
the session-219/220/221 logs supersede — corrected this session (contest-builder-ux,
contest-editor-shell; email/gdpr plans marked COMPLETE).

**Small follow-ups** (from prior audits, low priority): digest in-memory build should paginate
at scale; `pnpm pack` test-leak check in `publish:layer`; bulk PII review UI; specific-users
broadcast picker polish; entry-detail residuals; deferred a11y (`--accent` as small nav text).

## Standing rules (unchanged)
Test-driven; verify UI visually (run the app + screenshot/Playwright) before shipping;
theme/token edits in `packages/ui/theme/` (not the gitignored `layers/base/theme/`);
`var(--*)` only; no em dashes in user-facing copy; NO AI attribution in commits/PRs. Release
chain + deploy + local-run recipe: `docs/STATUS.md`.
