# Session 229 Handoff — Referral Links (RELEASING)

Date: 2026-06-26. Branch `referral-links`. Release in progress (see "Release log" at bottom).

## Release versions (session 229)
schema **0.55.0** · config **0.27.0** · server **2.101.0** · test-utils **0.5.9** · layer **0.90.0**. Migration **0038_milky_red_ghost** (referral_links + referral_attributions). Consumer pins (deveco-io + heatsynclabs-io) bumped to match: config ^0.27.0, schema ^0.55.0, server ^2.101.0, layer ^0.90.0.

A full-suite run (`pnpm test`, 33 tasks / 5334 tests) caught a regression the per-package runs missed: `layers/base/components/__tests__/registerConsent.test.ts` mounts `register.vue`, which now calls `useFeatures()` — the test had to stub it on globalThis (consent-gate assertions unchanged). Fixed; full suite green.

## What was done

Designed, built (TDD), audited (three rounds), and locally verified a **referral-links** feature: a logged-in user creates personal signup-attribution links (from the user menu / `/settings/referral-links`) that credit them for new signups and run a bounded list of onboarding actions (auto-join a hub, redirect on signup). Codes are auto-generated (conflict-free) or custom. Instance-local, never federates. Flag-gated OFF (`referralLinks`).

Plan + full design rationale: **`docs/plans/referral-links.md`** (kept current — read it for the architecture, the audit revisions, and accepted risks).

## State / versions

Nothing published. Working-tree changes only. Current published baseline is unchanged: schema 0.54.0 · config 0.26.0 · server 2.100.1 · layer 0.89.1. Migration `0038_milky_red_ghost.sql` (referral_links + referral_attributions) is generated + journaled but applied only to the LOCAL dev DB so far.

New code:
- `packages/schema`: `src/referral.ts`, `src/validators/referral.ts`, enums, migration 0038, barrels.
- `packages/config`: `referralLinks` flag + `config.referral` section (`cookieless`, `defaultAttributionWindowDays`) + `defineCommonPubConfig` input accepts `referral?`.
- `packages/server`: `src/referral/` module (codes, actions, links, attribution) + barrel.
- `layers/base`: `/r/[code]` short link, `server/api/referrals/*` (list/create/patch/delete/claim/resolve), `server/utils/referralCookie.ts`, `server/middleware/referral-claim.ts` (backstop), `pages/settings/referral-links.vue`, register-page capture/banner/claim, user-menu + settings nav entries, route feature-gates.
- `apps/reference`: ENV_FLAG_MAP += `referralLinks`. `packages/test-utils` + health.test flags literal updated.

## The architecture in one paragraph

Capture (`/r/:code` → indexed `lower(code)` lookup, `click_count++`, sets `cpub_ref` cookie = `code.issuedAtMs`, 302) → one idempotent `claimReferral()` (UNIQUE(referred_user_id) first-touch + ON CONFLICT) fired by a deterministic `POST /api/referrals/claim` (register page, returns the destination) AND a cookie-gated backstop middleware (OAuth/closed-tab; skips `/api/referrals/*` so the explicit endpoint owns its request). Onboarding actions are a bounded Zod union (`join_hub`, `redirect`), authz-checked at creation AND re-validated at claim time. Auth singleton is untouched; new logic is an isolated `referral/` module mirroring `hub/`.

## Audit rounds (what they caught — all fixed)

1. **New-user guard** (was a real hole): an existing logged-in user who merely clicked a `/r` link got attributed + auto-joined via the backstop. Fixed: `claimReferral` requires the account to be created at/after the click (click time carried in the cookie); cookieless → created within the last hour.
2. **Idempotent destination** (backstop-vs-explicit race): the referred user wasn't redirected to their hub when the backstop claimed first. Fixed via pure `deriveDestination` returned on every path + backstop skipping `/api/referrals/*`.
3. **Claim-time re-validation**: a hub flipped private after link creation is no longer auto-joined (`joinHub` has no privacy gate); `resolveReferral` returns only PUBLIC hub names (anonymous endpoint); suspended/deleted owners' links stop working.

## Production-readiness verdict: READY to release (flag OFF)

- **Typecheck**: repo 28/28.
- **Tests**: schema 509 (18 validator), config 27 (2 new), server 1548 (22 referral integration — covering new-user guard, idempotent destination, collision-retry + exhaustion, action-failure isolation, claim-time privacy re-validation, anonymous private-hub-leak, suspended owner, real ordering). All green.
- **Lint**: 0 errors (the 83 warnings are the repo's pre-existing baseline; none in referral code).
- **Live verify (Playwright + DB)**: manager page, `/r` redirect + `code.issuedAt` cookie, "invited by X" banner, explicit claim WITH cookie → attribution + auto-join + hub destination (the race fix), backstop firing on a normal page request (claims + clears cookie), counters, private-hub rejection.
- **a11y (axe, WCAG2 AA)**: the new UI (manager page + invite banner) has ZERO violations. (3 flagged items are pre-existing: global `.cpub-kbd`, and the existing register form's consent text + Log in link — not this feature.)
- **Consumer forks**: deveco-io + heatsynclabs-io WON'T BREAK — both use `defineCommonPubConfig` (Zod fills `referralLinks: false`); their nuxt.config feature objects are untyped runtime data that deep-merge over the base layer's. Verified.
- **Migration 0038**: journaled (idx 38) → applied by `db-migrate.mjs` on deploy.
- **Rate limiting**: the security middleware rate-limits `/api/referrals/*` + `/r/*` in production (skipped only for static assets + dev).
- **config.referral**: defaults flow via `defineCommonPubConfig` → `getBaseConfig` spread → `useConfig().referral`; operators opt into cookieless by setting `referral: { cookieless: true }` in `commonpub.config.ts`.

## Accepted risks (v1, no-payout community — documented, not bugs)

- `body.code` is honored as the referral signal (inherent to a shareable `?ref=` link; gated by new-user + first-touch). The day-based `attributionWindowDays` is cookie lifetime; the load-bearing gate is new-user + first-touch.
- `recordReferralClick` is an unauthenticated vanity counter (global rate-limiter applies).
- `signupCount` counts an attribution even if a join action fails (attribution ≠ action success).

## Follow-ups (not blockers)

- **GDPR export completeness**: `exportUserData` does not yet include a user's referral links / who-referred-them. Erasure is handled (FK cascade on user delete), but the data export should add referral data for parity with the session-227 GDPR work.
- **Env-toggle on forks**: deveco/heatsync `server/utils/config.ts` ENV_FLAG_MAP doesn't include `referralLinks`, so `FEATURE_REFERRAL_LINKS` won't toggle it there — they enable via `/admin/features` (DB toggle, works for any flag). Add to their map if env-toggle is wanted.
- **Manager hub picker** lists private hubs the user is in (create then 400s); could filter, low priority.
- **Pre-existing a11y**: register consent text contrast + Log in link distinguishability (not this feature).
- **confirmOnVerify** deferred (no email-verify hook + email OFF in prod) — `referral_attributions.status` keeps `pending`/`rejected` for the future.

## Release steps (the §16 chain — when approved)

1. Branch `referral-links`. Bump changed packages: schema (0.54→0.55, new tables) → config (0.26→0.27, flag + section) → server (2.100.1→2.101, referral module) → ui (only if a shared component changed — none did) → layer (0.89.1→0.90). `pnpm typecheck` (28/28) + suites green.
2. Publish in dep order (schema → config → server → … → layer via `pnpm run publish:layer`), polling `npm view` between.
3. Push branch → PR → squash-merge to main (commonpub.io deploys on push, migration 0038 applies). Flag stays OFF.
4. Canary: enable `referralLinks` on commonpub.io via `/admin/features`; exercise the live flow. Then bump deveco/heatsync pins (BOTH lockfiles) + curl `/api/health` on all 3.
