# Session 150 → 151 Handoff

Fresh Claude Code context. Session 150 (2026-05-19) shipped the
federation-hardening Stage 3 wrap (Items 4 + 8 + 9 + bundled F1, F2).
All 3 production instances are live, verified, and Stage 3 is fully
cleared — the `docs/plans/federation-hardening.md` plan has no open
work.

## Orientation — read in order

1. `CLAUDE.md` — standing rules. Re-emphasise:
   - **Never add Claude as co-author / Signed-off-by / any AI
     attribution to commits, in any repo.**
   - Schema changes via committed migrations + `scripts/db-migrate.mjs`
     — migration count is 5 (`0000_session128_baseline.sql` through
     `0004_federated_oauth_tokens.sql`); session 150 added no
     migrations.
   - Feature flags in `commonpub.config.ts` for any new behaviour.
   - `pnpm publish`, never `npm publish` (workspace:* literals
     break installs).
2. `docs/sessions/150-federation-hardening-stage3-wrap.md` — what
   shipped. Includes the deep-audit pass that caught a P0 (cookie
   double-URL-encode, same shape as session 149's safeFetch P0).
3. `docs/sessions/149-cdn-storage.md` — session 149 (CDN +
   audit + Stage 3 Items 6+7). The "Stage 3 ship verified — corrected
   understanding" section is load-bearing: federation flag was
   silently ON on commonpub.io + deveco.io since 137-ish (memory
   drift from "OFF in prod" snapshots). Verify flag state with
   `curl /api/features` before any "dormant" claim — see
   `feedback_verify_flag_state` memory.
4. `docs/plans/federation-hardening.md` — fully done; check the
   status line at the top, sections preserved for historical context.
5. `docs/llm/gotchas.md` — short-form invariants. Session 150
   additions appended at the end.
6. `codebase-analysis/09-gotchas-and-invariants.md` — long-form same.

## Current state (2026-05-21, end of session 150 + extensive post-wrap polish)

| Site | Versions live | Migration count | Federation flag | Identity flags | `CPUB_FED_TOKEN_KEY` |
|---|---|---|---|---|---|
| commonpub.io | schema 0.16.0, server 2.55.0, **layer 0.21.20**, infra 0.8.0, protocol 0.12.0, auth 0.6.0, config 0.13.0, ui 0.8.5, **editor 0.7.11**, explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6 | 5 | true (live-active) | all false | **SET** in `/opt/commonpub/.env` |
| deveco.io | (same) | 5 | true (live-active) | all false | **SET** in `/opt/deveco/.env` |
| heatsynclabs.io | (same) | 5 | false (dormant) | all false | **SET** in `/opt/commonpub/.env` (droplet path uses `commonpub`) |

All 3 droplets carry the per-instance 32-byte hex `CPUB_FED_TOKEN_KEY` (set live 2026-05-20). Backups in `secrets/CPUB_FED_TOKEN_KEYS.md` (gitignored). The keys are idle — every `identity.*` sub-flag is still `false`, so the ChaCha20-Poly1305 codepath doesn't run; the `assertIdentityConfig` invariant passes vacuously. **Flag flip is the natural next step (P3 below)**.

`CPUB_FED_TOKEN_KEY` env var is NOT set on any prod instance; the
identity flags are off so the identity-startup Nitro plugin's
`assertIdentityConfig(config)` short-circuits. **No identity feature
is enabled in prod today.**

Working trees: clean (commonpub repo); deveco clean; heatsync has
pre-existing unrelated local changes (`commonpub.config.ts` M,
`ONBOARDING.md` untracked — same drift session 149 noted).

## What's now possible end-to-end (vs what's still queued)

**Stage 3 hardening — DONE everywhere it can run with flags off:**

- `safeFetchResponse(url, options)` + `safeFetchSigned(signedRequest)`
  in `@commonpub/protocol`: Response-shape return (no throw on !ok),
  default `followRedirects: false`, combined `AbortSignal.any` for
  caller signal + internal deadline. Re-exported via `@commonpub/server`.
- All 6 federation outbound modules (`backfill`, `hubMirroring`,
  `delivery`, `federation`, `messaging`, `oauth`) now route through
  the SSRF-safe pinned dispatcher. `packages/server/src/federation/safeFetchFn.ts`
  wraps `safeFetchResponse` as a `FetchFn` for
  `resolveActor`/`resolveActorViaWebFinger`.
- Better Auth signed-cookie helper at
  `layers/base/server/utils/betterAuthCookie.ts` produces cookies
  byte-identical to Better Auth's own setSignedCookie. Wired into 3
  federated callbacks + delete-user. Identity flags are off so this is
  dormant; it WILL be live the moment any operator enables a
  linkRemoteAccounts/signInWithRemote flag.
- `getClientIp(event, opts?)` in `@commonpub/infra/security` reads
  the rightmost XFF token. Hot on all 3 prod sites today (rate
  limiter always runs). Caddy on all 3 OVERWRITES XFF so depth=1 is
  correct; multi-proxy operators set `CPUB_TRUSTED_PROXY_DEPTH=N`.

**What's NOT yet done (queued for session 151+):**

- **Two-instance interop test.** Items 6 + 7 (raw-body digest + sig
  coverage policy) shipped in session 149 and Items 4 + 8 + 9 in
  session 150 — but none of these have been exercised against a real
  second federating instance. Plan-of-record (federation-hardening
  doc): "stand up two CommonPub instances (or CommonPub ↔ Mastodon
  fixture) and prove signed inbound activities with a Digest header
  verify." We have commonpub.io + deveco.io both running federation
  flag ON; deveco's domain isn't currently set up as a peer for
  commonpub.io's actor (they don't follow each other). Spin up a
  Follow + Create flow between the two and watch the inbox.

- **Monitoring on inbox 401 rates.** Open from session 149: "no
  monitoring/alerting on inbox 401 rates that would let us *see*
  whether real traffic is now succeeding." Worth setting up before
  interop testing so we can quantify the "every signed inbound
  401'd before Stage 3" claim.

- **`CPUB_FED_TOKEN_KEY` decision.** All identity sub-flags (`linkRemoteAccounts`,
  `signInWithRemote`, `actingAs`, `remoteInteract`, `remotePublish`)
  remain false in prod. Enabling any one requires generating + setting
  this 32-byte hex env (the Nitro plugin's `assertIdentityConfig`
  refuses to boot otherwise). Stage 3 fix (Item 8) means the cookie
  half of that flow now actually works — but the flag-flip needs the
  key set first.

- **Item 4 in `oauth.ts` (token endpoint) was migrated but is
  identity-flag-gated so dormant.** Will activate the moment
  Mastodon-login or federated SSO is enabled.

- **Open: `signCookieValue` upstream issue** — none. The fix here is
  to NEVER pre-encode in the helper, because h3's `setCookie` →
  cookie-es `serialize` always does one `encodeURIComponent(value)`.
  Pre-encoding here gave double-encoded wire values that Better Auth's
  single-decode left as malformed signatures. Don't reintroduce the
  encode; the negative regression test
  (`betterAuthCookie.test.ts:182`) is the guard.

## ProjectView polish quintet (0.21.16 → 0.21.20)

After the main Stage 3 wrap (`@commonpub/layer@0.21.15`) shipped,
five more layer patches landed in response to user-reported visual
bugs cascading from heatsynclabs.io's project pages:

- **`@commonpub/layer@0.21.16`** — `ProjectView.vue` empty-sidebar
  suppression. Projects with no BOM/parts AND no community-hub now
  hide the right `<aside class="cpub-sidebar">` via `v-if="hasSidebar"`
  and reflow the grid through 4 layout states (`cpub-has-toc` ×
  `cpub-has-sidebar`).

- **`@commonpub/layer@0.21.17`** — class collision rename, the
  actual root cause of heatsync's project-page squish. ProjectView's
  `.cpub-content-grid` is now `.cpub-project-grid` (the homepage's
  `ContentGridSection` + `pages/index.vue` keep the original name).
  Heatsync's `theme/heatsync-ui.css` had written
  `.cpub-content-grid { ... !important }` intending to target the
  homepage card grid; the class collision in the layer meant the rule
  also clobbered ProjectView's TOC|content|sidebar layout into
  auto-filled 280px columns. Rename closed the footgun for all
  operators, not just heatsync. Memory:
  `feedback_view_identity_classes`.

- **`@commonpub/layer@0.21.18`** — prose image cap. `.cpub-prose img`
  capped at `min(100%, 760px)` (videos/iframes 880px). Once the
  content column got wider in 0.21.16/17, body images had ballooned
  to ~900px+ on desktop.

- **`@commonpub/layer@0.21.19`** — image size picker + cover-photo
  cap + page padding bump. Three changes bundled:
  - **`@commonpub/editor@0.7.11`** added `imageContentSchema.size: 's'|
    'm'|'l'|'full'`, the TipTap `CommonPubImage` node's `size`
    attribute, and the S/M/L/Full button picker UI in `ImageBlock.vue`.
    Default `'m'` for new uploads; pre-picker BlockTuples fall back
    to `'l'` (matches 0.21.18's 760px cap, preserves visual width of
    existing content).
  - `BlockImageView.vue` applies `.cpub-image-size-{s|m|l|full}` (S:320,
    M:540, L:760, Full:100%).
  - `ProjectView.vue` `.cpub-cover-photo` capped at 880px + centered
    (was unbounded — that's the "still pretty big" follow-up). And
    `.cpub-page-outer` padding bumped from `clamp(12px, 3vw, 32px)`
    to `clamp(20px, 3.5vw, 40px)` — a smidge more horizontal
    breathing room.

- **`@commonpub/layer@0.21.20`** — block-component prose-style
  resets. `layers/base/theme/prose.css` has global rules on bare
  `<pre>` and `<th>` inside `.cpub-prose` that leaked into our
  scoped block components (BlockCodeView's `<pre class="cpub-code-body">`
  got a 3px border + 16px margin → "floating bar with gap then code
  block" effect; BlockPartsListView's `<th>` got a 1px border that
  with `border-collapse: collapse` looked like "rounded gaps" between
  cells). Fix: explicit `border: 0 !important` resets in the scoped
  CSS of both. Memory: `feedback_prose_style_leak`.

Live verified on all 3 instances. **Known latent leak**: BlockMathView
`<pre class="cpub-math-expression">` has the same `border + bg #0d1117
+ padding` leak from `.cpub-prose pre`. Math blocks are rare, not
user-reported; deferred. Apply the same `border: 0 + background:
transparent` reset pattern when it becomes visible.

## Scaffolder upgrade — auto-generated secrets

**`tools/create-commonpub@0.5.2`** — added `rand = "0.8"` dep + a
`generate_hex_token(byte_len: usize)` helper. `render_env` now
auto-generates both `NUXT_AUTH_SECRET` AND `CPUB_FED_TOKEN_KEY` on
every scaffold (was `change-me-in-production-min-32-chars`
placeholder for AUTH_SECRET, commented-out `# CPUB_FED_TOKEN_KEY=`).
DO App Platform spec (`render_do_app_spec`) also auto-fills both as
`type: SECRET`. Two new cargo tests assert (a) both secrets are real
64-hex-char values (no placeholder), and (b) consecutive scaffolds
produce DIFFERENT values (RNG-uniqueness check). 29/29 cargo green.
Keys are per-instance by design — `CPUB_FED_TOKEN_KEY` is the
ChaCha20-Poly1305 key for `@commonpub/infra/tokenCrypto`; sharing
across instances would let one site decrypt another's stored OAuth
bearer tokens.

## Doc updates landed alongside the post-wrap fixes

- `docs/reference/guides/theming.md` got a new "Custom Theme Overrides
  — Class-Naming Gotchas" section: view-identity class table (safe
  override targets), the historical footgun written out, three
  recommended patterns, and a most-shared-classes table for
  cross-checking. The doc explicitly tells operators that **cosmetic
  global overrides are fine** (heatsync's `cpub-btn`, `cpub-tab`,
  `cpub-tabs-inner`, `cpub-sb-card` collisions all worked as intended
  cosmetic harmonization) but **structural overrides must target the
  view-identity class** (`cpub-project-grid`, `cpub-content-grid`,
  `cpub-article-wrap`, `cpub-listing-grid`).
- `docs/plans/redis-integration.md` updated to reflect that the work
  shipped in session 130; the plan body is now historical-context-only.
- `codebase-analysis/09-gotchas-and-invariants.md` fixed the two
  factually-wrong claims about Redis ("provisioned but unused") and
  SSE ("single-instance only") that had survived from session 125.
- `codebase-analysis/README.md` rewritten — per-file freshness now
  itemized instead of blanket-STALE.

## Deep audit findings (corrected post-investigation)

A full-repo audit ran late session. Initial reading of
`instance_mirrors.last_sync_at = 2026-05-11` (10 days stale) on
commonpub.io was misread as "federation broken." User corrected:
"commonpub has all the latest posts afaik from deveco.io." Verified:
push delivery IS working (deveco→commonpub: 491 delivered, 0 recent
failures, last_success 2026-05-11). deveco just hasn't published much
in 10 days. Pull-mirror is the BACKSTOP, not the primary path —
dormant because push is current. Memory:
`feedback_federation_health_metrics`.

**Confirmed-real findings still standing:**

- **deveco droplet has 18.87 GB of stale Docker build cache** (24/77 GB
  disk used). One-time fix: `ssh root@deveco.io 'docker builder prune
  -af'`. Recovers ~25% of disk. ~60 seconds.
- **10 old failed activities on deveco** (oldest 2026-03-26, newest
  2026-05-16). Failure modes: "No target inboxes found", "No keypair
  for actor" — pre-Stage-3 edge cases. Sit in `failed` status, no
  retry. The activity-status enum doesn't have `dead_lettered`
  (schema gap noted; the code references it but the enum doesn't
  define it). Worth: write an admin tool or one-off SQL to either
  retry or move to a terminal state.
- **`mirror.content_count` cumulative counter misleads** —
  commonpub's mirror to deveco shows `content_count=952` but
  `federated_content` only has 40 rows from deveco. The counter
  increments on every received activity, never decrements on
  dedup/soft-delete/filter. Worth renaming the column or the UI
  label to `total_received_count` so the admin reading "952 items
  federated" isn't misled when only 40 are renderable.
- **heatsync mirror config on deveco is a dead-loop**: deveco pulls
  from heatsync but heatsync federation is `false` → heatsync serves
  no outbox → forever-zero. Either delete the mirror config on
  deveco OR flip heatsync federation `true`.
- **Redis fail-open events** on commonpub.io: 2 events / 6 hours
  ("Stream isn't writeable and enableOfflineQueue options is false").
  Intermittent; fail-open per session 130 design. Worth monitoring.

**Federation actually IS healthy** — deveco has 10,222 activities
total (9,722 inbound processed, 490 outbound delivered, 10 failed
historical). Federates with mastodon.social + glitch.social per
`instance_health`. ~200 activities/day for the past 2 weeks.

## What to focus on next — priority-ordered

### P0 — Security advisory (Nuxt + better-auth + jose patches)

`pnpm audit --prod` reports **48 vulnerabilities** (4 low, 26
moderate, 18 high). The direct-dep ones we can act on:

- **Nuxt 3.21.5 → 3.21.6** — GHSA-g8wj-3cr3-6w7v. Direct dep, patch
  bump, low risk. Do this first.
- **Vite (transitive of Nuxt)** — GHSA Arbitrary File Read via
  WebSocket. Patched via Nuxt upgrade.
- **better-auth 1.6.4 → 1.6.11** — minor bump on a security-critical
  dep. **Caveat**: session 150's Better Auth signed-cookie helper at
  `layers/base/server/utils/betterAuthCookie.ts` was pinned against
  better-auth 1.6.4 + better-call 1.3.5 cookie format. **Before
  bumping, re-verify the cookie shape** against the cited lines
  (cookie name prefix logic + better-call `crypto.mjs:22-32`
  signing). If unchanged → bump is safe. If changed → either pin to
  1.6.4 or update the helper to match.
- **jose 6.2.2 → 6.2.3** (HTTP Signature lib) — patch bump. Verify
  against `packages/protocol/src/sign.ts` + `keypairs.ts`.

Most of the remaining 48 are deep transitive deps (kysely, lodash,
node-forge, simple-git, axios, devalue, flatted) inside Better Auth /
megalodon — won't move without upstream. Document + accept.

### P1 — Two-instance interop test for federation

Stage 3 Items 4 + 6 + 7 + 8 are LIVE-ACTIVE on commonpub.io + deveco.io.
With **9,722 inbound activities processed** on deveco (federating with
`mastodon.social`, `glitch.social`, and commonpub.io) the SSRF-safe
+ strict-coverage path is already exercised at scale. But Item 8's
cookie helper has NOT been validated against a real linked-account
flow — needs `signInWithRemote` to be flipped on (P3).

Lower-hanging: pick a peer-pair (commonpub.io ↔ deveco.io) and
explicitly establish a Follow + verify a Create activity round-trips
with the new strict-coverage policy. Mostly a smoke test now.

### P2 — Inbox 401 monitoring

Open since session 149. `createStructuredLogger` is already plumbed
via `createRedisFailOpenLogger`. Add an `inbox.401` event emit in
`layers/base/server/utils/inbox.ts` (rejection path), then add a
Loki/Datadog/CloudWatch hook with an alert on 401-rate > threshold.
Without it we can't tell if real signed-inbound traffic is succeeding
post-Stage-3.

### P3 — Flag flip: enable `signInWithRemote` on deveco.io (canary)

**Keys are now in place on all 3 droplets** (`CPUB_FED_TOKEN_KEY`
set live 2026-05-20). The remaining step is flipping one identity
sub-flag and exercising Mastodon-login against a real linked account.

deveco.io is the canary — it federates with the most peers (491
outbound delivered to commonpub, 3 to mastodon.social, 1 to
glitch.social). Steps:
1. Edit deveco's `commonpub.config.ts` →
   `features.identity.signInWithRemote: true`.
2. Commit + push → deploy auto-runs.
3. `curl /api/features.identity.signInWithRemote` returns `true`.
4. Open deveco's login page in browser → "Sign in with Mastodon"
   button appears.
5. Log in via a real Mastodon account (any test instance).
6. Watch the callback → `auth.api.getSession` should authenticate
   the new federated cookie → user sees /dashboard with their
   linked-Mastodon profile.
7. Verify `federated_accounts` row created with encrypted token.
8. If green: roll to commonpub.io. If red: hotfix.

### P4 — Instance self-update admin feature (NEW — see plan)

User asked for a feature: instance operator clicks "Update" in admin
panel → instance auto-updates to latest `@commonpub/layer` + `@commonpub/server`,
runs DB migrations, restarts. Full implementation plan at
`docs/plans/instance-self-update.md`. Roughly: GitHub workflow_dispatch
trigger → bump pins + push → existing deploy workflow handles the rest.
Phase 1 MVP is ~2-3 sessions of work.

### P5 — One-time cleanup tasks (deferred)

- `docker builder prune -af` on deveco — recover 18.87 GB. 60 sec.
- Retry / dead-letter the 10 stuck `failed` activities on deveco.
- Delete (or activate via heatsync federation flag) the dead-loop
  mirror config from deveco→heatsync.
- Rename `instance_mirrors.content_count` → `total_received_count`
  (or fix the admin UI label) so the cumulative counter isn't
  misread.
- Add `dead_lettered` to `activity_status` enum (referenced in code,
  missing from schema enum). Migration 0005.

### P6 — Routine dev-dep bumps

`pnpm outdated --recursive`: vue 3.5.32 → 3.5.34, @vue/test-utils,
axe-core, turbo, @vitejs/plugin-vue. Routine. Batch after P0 security
bumps land. Skip `@types/sharp` (deprecated upstream).

### P7 — Class-hygiene proactive renames (DEFERRED — wait for collision)

Audit identified `cpub-sidebar` (12 files), `cpub-prose` (8), `cpub-sb-card`
(8), `cpub-tab` (6) as the next latent footguns of the same shape as
the heatsync squish. Currently NOT causing problems (Vue scoping
isolates each component's rules). Don't preemptively rename. The
theming doc + the `feedback_view_identity_classes` memory cover the
operator-side guidance.

### P8 — BlockMathView prose-style leak (known but deferred)

Same pattern as BlockCodeView/BlockPartsListView fixed in 0.21.20.
`<pre class="cpub-math-expression">` gets `border + bg #0d1117 +
padding` from `.cpub-prose pre`. Math blocks are rare, not user-reported.
Fix is `border: 0 !important; background: transparent` in the scoped
CSS — same pattern as 0.21.20. Batch into next layer patch.

### P9 — Phase 4 federation (delegated actions)

The cross-instance-identity foundation (sessions 136–140) shipped the
`ActionRoute` machinery but only Phase 1b runtime is wired. Phase 4
adds remote-publish/like/follow/comment via the registered
`fediClient` factory. This is the BIG product feature — gated on
(a) federation flag (done), (b) `CPUB_FED_TOKEN_KEY` set (done now),
(c) `identity.*` sub-flag enabled (P3), (d) a peer to actually
federate against (deveco↔commonpub already, plus Mastodon-class).
Sequence as the natural completion of P3.

## Other queued items (informational)

- **deveco's `nuxt.config.ts`**: was bumped to `^0.21.17` for the
  ProjectView class rename. No further deveco-side changes outstanding.
- **heatsync's `theme/heatsync-ui.css`**: still has the cosmetic
  overrides (`cpub-btn`, `cpub-tab`, `cpub-tabs-inner`,
  `cpub-sb-card:has(.cpub-stats-grid)`) — all intentional. Their
  `ONBOARDING.md` line 66 references `.cpub-content-grid` as the
  homepage card-grid override pattern; technically correct (since the
  class is now exclusively the homepage's). Could add a note that
  cosmetic-global is fine but structural needs view-identity targeting.
- **Scaffolder pin state** (post-session 150 polish): layer
  `^0.21.17`, server `^2.55.0`, schema `^0.16.0`, config `^0.13.0`.
  Cargo `package_json_pins_current_commonpub_versions` test asserts
  these — update both together on any future publish.

## What to watch for in this session

1. **`curl /api/features` before any "dormant" claim.** The
   `feedback_verify_flag_state` memory note exists because session
   137's "all flags off in prod" snapshot drifted; session 149
   discovered federation was actually ON. Empirical check first.

2. **Algorithm tests pass, integration breaks** — see the new
   `feedback_integration_test_full_output_path` memory. When adding a
   primitive that flows through h3/undici/Nuxt, write an integration
   test through the actual framework layer, not just an algorithm-level
   unit test. Both session 149 and session 150 caught a P0 of this
   exact shape mid-audit. Add a NEGATIVE regression-guard test that
   proves the broken version would fail.

3. **`getAuthSecret()` in `betterAuthCookie.ts` MUST stay in sync
   with `layers/base/server/middleware/auth.ts:27-33`.** If
   they diverge, our helper signs cookies with a different key than
   Better Auth's `getSession` verifies against, and federated logins
   are dead-on-arrival. Comment is in the helper.

4. **`signRequest` in `@commonpub/protocol/src/sign.ts` signs
   `(request-target) host date digest`** (NOT content-type). The
   strict inbound coverage policy (`verifyHttpSignature`) requires
   exactly those headers. If you change the outbound set, the inbound
   verifier will reject our own signatures from federating instances.

5. **`tools/create-commonpub/src/template.rs` pin constants must be
   bumped after every publish.** Currently at `^0.21.20` (layer) and
   `^2.55.0` (server) — match the latest publish. The cargo test
   `package_json_pins_current_commonpub_versions` is the regression
   guard.

6. **Heatsync's working tree has unrelated local changes**
   (`commonpub.config.ts` M, `ONBOARDING.md` untracked). Don't touch
   those; they're the operator's instance customizations. Stage only
   package.json + pnpm-lock.yaml when bumping pins.

7. **`pnpm publish` not `npm publish`** for the layer. The repo's
   `publish:layer` script (`pnpm --filter @commonpub/layer publish
   --no-git-checks --access public`) is the canonical command;
   session 149's botch (0.21.12 published with literal `workspace:*`)
   is documented in `feedback_pnpm_publish_layer` memory.

8. **NPM propagation lag is real.** `npm view <pkg>@<ver> version`
   can return the version while `npm pack <pkg>@<ver>` errors with
   ETARGET (different replica). After publish, poll with `npm view`
   before the dependent install. See `feedback_npm_propagation_lag`
   memory.

## Where the new symbols live

- `safeFetchResponse(url, options): Promise<SafeFetchResponseResult>` —
  `packages/protocol/src/ssrf.ts:283`, re-exported via
  `@commonpub/protocol`, `@commonpub/server` (canonical paths).
- `safeFetchSigned(signedRequest, options?): Promise<SafeFetchResponseResult>` —
  same file `:378`, same re-exports.
- `SafeFetchResponseResult` type — same file `:215`.
- `getClientIp(event, opts?): string` — `packages/infra/src/clientIp.ts`,
  exported via `@commonpub/infra/security`, `@commonpub/server`.
- `setBetterAuthSessionCookie(event, token, expiresAt): void` and
  `clearBetterAuthSessionCookies(event): void` — `layers/base/server/utils/betterAuthCookie.ts`.
- `createSafeActorFetchFn(): FetchFn` — `packages/server/src/federation/safeFetchFn.ts`.

## Test counts (locked, end of session 150 + extensive polish)

- `@commonpub/protocol` 419/419 (+17 vs session 149: 14
  safeFetchResponse + 2 AbortSignal + 1 lowercase-headers)
- `@commonpub/infra` 305/305 (+17 clientIp)
- `@commonpub/server` 964/967 (3 expected PGlite skips)
- `@commonpub/editor` 230/230 (image-size picker added but no new
  tests — picker is in the Vue component, schema enum covered by
  existing Zod parsing tests)
- `@commonpub/layer` 85/85 (cookie shape + project polish + prose
  resets — no new tests, all kept green through the quintet)
- Cargo (scaffolder) 29/29 (+2 vs prior: `env_auto_generates_strong_secrets`,
  `env_secrets_are_unique_per_scaffold`; pin assertion updated for
  ^0.21.20)
- Workspace typecheck 26/26, lint 24/24

## Conventions / gotchas added this session

- **No `rm -rf` chained even in /tmp** — user pushback caught a
  cleanup `rm -rf ./*` in a chained command. Memory:
  `feedback_destructive_rm_even_in_tmp`. Run destructive deletes as
  separate, explicit commands.

- **Always test the FULL output path including framework
  serialization** — memory: `feedback_integration_test_full_output_path`.
  Session 149 + 150 both shipped a P0 caught only by deep audit
  because unit tests fed helper output to a verifier of the same
  algorithm. Real bug was at the framework integration boundary.
  Pattern: simulate cookie-es / undici / Nitro exactly and assert
  end-state. Add a negative regression-guard.

- **CSS view-identity classes prevent operator-override collisions.**
  Per-view layout classes in the layer must be uniquely-named
  (`cpub-project-grid`, `cpub-article-wrap`, `cpub-listing-grid`,
  `cpub-content-grid` = homepage). Operators write theme overrides
  targeting these "generic-looking" classes; if multiple views share
  a name, a homepage-targeted `!important` rule clobbers other
  views. The session 150 squish bug was this exact shape. New layer
  components must avoid shared names for view-grid/layout classes;
  cosmetic-shared classes (`cpub-btn`, `cpub-prose`, `cpub-tab`)
  are fine. Memory: `feedback_view_identity_classes`. See
  `docs/reference/guides/theming.md` for the full decision rule.

- **Block components must reset `.cpub-prose pre`/`th`/`blockquote`
  global styles** for any property they don't redeclare. Memory:
  `feedback_prose_style_leak`. The global rules in
  `layers/base/theme/prose.css` target bare elements inside `.cpub-prose`
  (intended for federated/markdown content); they leak into scoped
  block components for unset properties. 0.21.20 fixed code + parts
  table with explicit `border: 0 !important`; BlockMathView still has
  the same latent leak (math is rare, not user-reported).

- **`instance_mirrors.last_sync_at` ≠ "last federation activity".**
  Memory: `feedback_federation_health_metrics`. Push delivery is
  primary; pull-mirror is backstop. Cross-check
  `instance_health.last_success_at`, recent inbound `activities`, and
  `federated_content.received_at` before declaring federation stale.
  `mirror.content_count` is cumulative-lifetime, not current-row
  count.

- **Heatsync's SSH key isn't `~/.ssh/id_ed25519`** — it's at
  `/Users/obsidian/Projects/heatsync/heatsynclabs-io/secrets/ci_deploy_ed25519`
  (`heatsynclabs-ci-deploy`). Always `ssh-add <path>` it explicitly
  before cross-droplet ops. Also note heatsync's app lives at
  `/opt/commonpub/` on the droplet (legacy naming — droplet hostname
  is `commonpub-heatsynclabs` per doctl). Memory:
  `feedback_deployment_architecture` (updated with SSH paths per
  droplet).

## Standing rule reminders

- Schema is the work. Migration count holds at 5; no schema change
  this session.
- No feature without a flag. No new flags this session.
- `var(--*)` only — no hardcoded colors/fonts.
- WCAG 2.1 AA min.
- Sessions logged at `docs/sessions/NNN-*.md`.
- Squash merge to main.
