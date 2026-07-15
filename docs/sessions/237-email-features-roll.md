# Session 237 — email block bodies + registration block + unverified email + test-send: BUILT, AUDITED, ROLLED to all 3

Date: 2026-07-15. The `feat/contest-email-block-editor` arc (sessions 235-237) shipped to production on all
three instances after a zero-assumptions pre-roll audit.

## What shipped (LIVE on commonpub.io + deveco.io + heatsynclabs.io)
npm: **schema 0.58.0 / config 0.32.0 / editor 0.11.0 / infra 0.15.0 / server 2.108.0 / test-utils 0.5.12 /
layer 0.100.0**. CLI **create-commonpub 0.5.23** (crates.io; pins ^0.100/^2.108/^0.58/^0.32). **NO migration.**
Two new feature flags → live went **34 → 36**.

1. **Block-editor email bodies** — `ContestEmailCopy.bodyBlocks` (BlockTuple[], in the existing `email_copy`
   jsonb, no migration). `renderEmailBlocks` (server) renders a curated email-safe subset (text/heading/
   quote/callout/image/divider/registrationLink) with inline styles, HTML-escaping, http(s)-only media, and
   `{token}` interpolation; unknown/interactive blocks dropped. Templates prefer `bodyHtml` > legacy `intro`
   > built-in default; `buildContestEmailCopyOverride` renders per-recipient. (The block-editor UI itself —
   M3 — is NOT built; the editor still uses Subject + Intro textarea. Backbone is ready for it.)
2. **Registration-link CTA block** — `registrationLink` block droppable in article/project/explainer content.
   Shared `buildRegistrationHref` guards the href (rejects `javascript:`/`data:`/protocol-relative `//` AND
   backslash `/\host`, defaults to `/auth/register`). Flag **`registrationBlock`** (default ON).
3. **`emailUnverified` flag** (default OFF) — when ON, the verified-address gate is skipped across ALL send
   paths (instant + digest notifications, contest confirmation + reminders, admin broadcast); verification
   then gates sign-in only. Global unsubscribe still always honored. deveco = ON (it has a real Resend
   transport this session); others OFF.
4. **Contest "send a test email"** — `POST /api/contests/:slug/email-test` delivers the active template (with
   the current draft) to an arbitrary email OR a user (server resolves the address; never trusts a client
   address for a userId; subject `[TEST]`; organizer-gated). UI: email field + fuzzy user-search dropdown in
   `ContestEmailEditor.vue` (reuses the contest-manager `user-search` endpoint).
5. **Admin broadcast picker** now shows display names (search was already fuzzy on username+email).
6. **`alex` preview fix** — email preview uses the signed-in user's username (verified live in the browser).

## Pre-roll audit (ultracode, zero-assumptions) → GO_WITH_CAVEAT
Publish set = exactly the 7 changed packages, nothing omitted/spurious; NO migration; every changed export
ADDITIVE (new params default-valued → back-compat); both flags safe in default state. Caveats (all deploy-
mechanics, handled): the 0.x minor crosses (schema 0.57→0.58, config 0.31→0.32, editor 0.10→0.11, infra
0.14→0.15, layer 0.99→0.100) mean `^0.x` caret pins do NOT auto-cross — CLI (`template.rs`+`cli.rs`) and
BOTH forks hand-edited; fork lockfiles regenerated (deveco pnpm-lock; heatsync BOTH). Server 2.107→2.108
caret self-heals but bumped for lockstep.

## The requireEmailVerification hold (important)
deveco's config had staged BOTH `emailUnverified: true` AND `requireEmailVerification: true`. The latter was
**deliberately reverted before the deveco push** — it gates sign-in, and every existing deveco user is
currently unverified, so enabling it live would have locked them all out. Only `emailUnverified: true`
shipped. To enable verification later: backfill existing accounts to `email_verified=true` first.

## Verified live (all 3)
health ok; `/api/features` = **36 flags** each; `registrationBlock` ON everywhere; `emailUnverified` ON
deveco only (OFF = no behavior change on commonpub/heatsync); test-send route unauth → **401**; deveco CI
typecheck green; crates.io = 0.5.23. deveco Resend transport wired via the deploy-time secret injection
(session 236) — deveco now actually delivers mail.

## Remaining / follow-ups
- **M3** — the block-editor email UI (backbone shipped; textarea still in the editor). Build with a live app
  run + visual verify.
- Contest Signup widget (two-tier register/reminders + verify-at-opt-in); verify-reminder + resend-
  verification UX (needed since verification-on locks out unverified users).
- Non-blocking: `noreply@deveco.io` must be a verified Resend sending domain or deveco sends fail (gracefully).
- E2E: public + authenticated contest flows captured this arc (see e2e-screenshots/, gitignored); the `alex`
  fix confirmed live in the email editor.
