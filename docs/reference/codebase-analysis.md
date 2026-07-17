# CommonPub Codebase Analysis (canonical)

_Last verified: 2026-07-17 (session 243). Regenerate/re-verify before relying on
LOC/version/test counts — they drift._

Baseline (verified 2026-07-17, session 243): npm latest
server **2.117.3** / schema **0.60** / config **0.34** / protocol **0.15.1** / auth **0.11** /
ui **0.13.3** / editor **0.14** / infra **0.19** / docs **0.6.3** / explainer **0.8** /
learning **0.5.2** / theme-studio **0.6.1** / test-utils **0.5.13** / layer **0.109**;
CLI create-commonpub **0.5.29** (pins stale — behind current). **38 feature flags** live on all 3 instances
(commonpub.io, deveco.io, heatsynclabs.io — all health ok). Latest migration **0043**.

## 1. Architecture

pnpm + Turborepo monorepo. Three tiers:

```
packages/*        pure/shared libraries (published to npm)
layers/base       @commonpub/layer — the Nuxt 3 layer where the PRODUCT lives
                  (all pages/components/server API/theme). Published to npm.
apps/reference    @commonpub/reference — thin Nuxt shell consuming @commonpub/layer
                  (config + a couple overrides + seed + E2E). private.
tools/create-commonpub   Rust CLI that scaffolds a new instance.
../deveco-io, ../heatsynclabs-io   two consumer forks (out of this repo).
```

Data flow (request): browser → Nuxt (layer) page/component → layer `server/api/*`
route → `@commonpub/server` business logic → Drizzle → Postgres. Federation: inbound
AP → layer `server/routes` inbox → `@commonpub/server/federation` → `@commonpub/protocol`
(HTTP-sig verify, sanitize, SSRF-pinned actor fetch) → Drizzle. Config/flags:
`commonpub.config.ts` → `@commonpub/config` → `useConfig()`/`requireFeature()` gate
every feature. Auth: Better Auth via `@commonpub/auth`; layer middleware `enrichUser`
re-reads `users.role` **fresh per request** (no cached grant staleness).

Tech (locked): Nuxt 3 + Vue 3, Better Auth, **pure-TS ActivityPub in `@commonpub/protocol`
(NOT Fedify)**, Postgres 16 + Drizzle, TipTap (content) + CodeMirror (docs), Meilisearch
(+ Postgres FTS fallback), Redis/Valkey queue.

## 2. Per-package inventory

Strict TS (`strict:true` + `noUncheckedIndexedAccess`) is inherited from root by every
package; zero real `any` across the tree (grep hits are comments). Full script set =
build/dev/test/lint/typecheck/clean unless noted.

| Package | Ver | Src LOC | Purpose (1-line) | Health note |
|---|---|---|---|---|
| schema | 0.59 | 6,422 | Drizzle tables + Zod validators + enums + OpenAPI; data-model source of truth | Full scripts. Table defs mostly untested (coverage skews to validators) |
| config | 0.33 | 721 | `defineCommonPubConfig` + flag schema/types — the gate everything checks | Full scripts. 1 test file (thin but sound) |
| protocol | 0.14 | 2,579 | Pure-TS AP: WebFinger, NodeInfo, HTTP-sig, inbox/outbox, SSRF, sanitize | **Best-tested** (tests 5,450 LOC > src; dedicated security/ + interop/ suites) |
| auth | 0.10 | 632 | Better Auth wrapper, role guards, RBAC core, AP-actor SSO (Model B) | Full scripts. Strong coverage. (roleGuard fail-open — see review #12) |
| server | 2.113 | ~28k | Framework-agnostic business logic (all domains) | Full scripts. Monoliths: content.ts 1433, hubMirroring 1608, inboxHandlers 1523 |
| ui | 0.13.2 | ~9,131 | 22 headless Vue components + theme CSS (base/agora/stoa/prose/layouts) | Full scripts. Every component has a test + a11y/keyboard suites. Raw theme CSS untested |
| editor | 0.11 | ~11,936 | 18 TipTap extensions + BlockTuple serialization + markdown parser + Vue block renderers | ⚠ `vue/` tree (~5k LOC incl. 681-LOC BlockCanvas) NOT typechecked/linted by pkg scripts (src-only) |
| theme-studio | 0.6.1 | 2,406 | Pure-TS recipe→WCAG-checked token generator | Full scripts. Cleanest in its group |
| docs | 0.6.3 | 2,320 | Docs pipeline: markdown render + versioning + nav + Meili/PG search | Full scripts. High test:src ratio; 1 `as any` (unified escape hatch) |
| infra | 0.19 | 2,400 | Storage (S3/local, **incl. private-file path** — uploadPrivate/getPrivateObject/deletePrivate), image (sharp), email, security, token crypto, Redis rate-limit/pubsub | `lint` added session 242 (commit 48e3c958) |
| explainer | 0.8 | ~8.7k | Interactive explainer engine (pure-TS) + optional Vue viewer/editor | ⚠ `vue/` tree (~5.3k LOC) NOT typechecked/linted by pkg scripts (src-only) |
| learning | 0.5.2 | 637 | Learning-path engine (pure-TS, instance-local) | Full scripts. Every logic module tested |
| test-utils | 0.5.13 | 347 | Shared factories + mock config | Full scripts |

**server/ domain map** (all under `packages/server/src/`, one shared package.json):
`content/` (CRUD/versioning/forking/visibility — content.ts 1433) · `federation/`
(9,148 LOC/19 files — delivery, inbox, hub federation/mirroring, oauth, timeline,
backfill, circuit breaker) · `contest/` (16 files, 3,467 LOC) · `hub/` (2,875 LOC —
posts 860, members 638) · `social/` (**comments live here**, social.ts 867 incl.
fail-closed comment-visibility gating) · `comms/` (email outbox/broadcast/branding/
unsubscribe) · `referral/` · `notification/` · `messaging/` · `voting/` (contest-entry
+ hub + poll votes).

## 3. Build-pipeline state (verified)

The monorepo's Turbo tasks are only as good as each package's own scripts. Confirmed gaps:

- **`layers/base` (@commonpub/layer, ~94k non-test LOC — where the product lives):**
  package.json scripts are **only** `{ test, prepublishOnly: bundle-theme.mjs }`. **No
  `typecheck`, no `lint`, no `build` script.** Turbo's typecheck/lint tasks are no-ops
  here. The layer is only type-checked/linted **transitively** when `apps/reference`
  runs `nuxt typecheck` / `eslint .` over consuming code. **This is the single largest
  build-pipeline hole in the repo.** No local `tsconfig.json` (relies on Nuxt defaults).
  **Session 243 partial mitigation:** `deploy.yml` now runs an inline `pnpm typecheck` + `pnpm lint`
  gate before the Docker build, so a layer type/lint error can no longer reach production even though
  the layer isn't independently checked.
- **`packages/infra`:** `lint` script added session 242 (commit 48e3c958) — the group gap is closed.
- **`@eslint/js` pin:** held at `^9.0.0` (session 243). A `^10.0.1` bump had turned CI's Lint red for 12+
  commits (expanded `recommended` set); do not re-bump without triaging the new-rule violations repo-wide.
- **`packages/editor` `vue/` and `packages/explainer` `vue/`:** the package `typecheck`
  (`tsc --noEmit`) and `lint` (`eslint src/`) both target `src/` only, so the raw-shipped
  Vue trees (editor: ~5k LOC incl. BlockCanvas 681; explainer: ~5.3k LOC) are checked
  only downstream, not by their own package.
- **theme source of truth:** `packages/ui/theme/*.css` → copied to gitignored
  `layers/base/theme/` by `layers/base/scripts/bundle-theme.mjs` at `prepublishOnly`.
  Edit the `packages/ui/theme` originals; run bundle-theme to reflect locally.

Everything else (schema/config/protocol/auth/server/ui/theme-studio/docs/learning/
test-utils/apps.reference) has the full build/lint/typecheck/test script set.

## 4. Test-coverage map

- **Strongest:** `protocol` (tests > source; security + interop suites), `ui` (per-component
  + a11y/keyboard), `learning`, `docs`, `auth` (every module), `editor` src extensions (18/18).
- **Centralized server tests:** 115 files in `packages/server/src/__tests__` (76 integration
  via pglite/pg). ~41 federation, ~10 content, 15 hub, 9 contest, 6 comms.
- **Notable gaps (unit level):**
  - `layers/base`: **0 tests across 99 `pages/`** and **0 across `plugins/`** — exercised
    only via `apps/reference` E2E (8 Playwright specs). Big untested Vue views: ProjectView
    1,535 · docs edit 1,289 · index 1,213 · admin/layouts 1,138 · LayoutSection 1,028.
  - `server/voting/`: **0 dedicated tests** despite race-safety claims (hub/poll/contest votes).
  - `server/social/`: no dedicated `comments.test.ts`; the 867-LOC comment+visibility logic
    is exercised only via `social.integration.test.ts` (notable given it's a fail-closed
    security gate).
  - `editor/vue/` + `explainer/vue/`: block renderers/canvas/editor components near-untested.
  - `schema`: most declarative table modules untested (validators are well-covered).
  - CLI: `template.rs` (899 LOC) covered only via end-to-end CLI tests, no unit tests.

## 5. Federation scope (per CLAUDE.md — verified against code)

Federates via AP: Projects, Blogs (Articles is a deprecated alias → normalizes to `blog`
on write), Explainers (all as `Article` + `cpub:type`); Hubs partial (Group actor, behind
`features.federateHubs`, posts as `Announce`). Instance-local (never serialized through
`@commonpub/protocol`): Docs, Learning Paths, Contests, Videos, Messages, Layouts,
Referral Links, Hub Flags. Federated feeds filter by `config.instance.contentTypes` so
unsupported types don't leak. **Federation LIVE since session 188.**

Security posture of the AP boundary is generally strong (SSRF-pinned actor resolution,
signed-header coverage policy, Date-skew replay window, raw-body digest verify,
keyId/actor + actor/signer host binding). **But** the inbox does **not** bind inner
`object.id`/`attributedTo` host to the authenticated actor — see review finding #1 (P1).

## 6. Known hotspots / debt (factual, not all bugs)

- **Monoliths flagged for de-monolithing:** `content.ts` (1433), `hubMirroring.ts` (1608),
  `inboxHandlers.ts` (1523); several 1000+ line Vue views in the layer.
- **Resolved debts (verified still holding, do not re-report):** consumer hooks bus live,
  transactional counters, keyset pagination, per-request fresh role read (`enrichUser`),
  reconcile-counters removed.
- **Open correctness/security items:** captured in `docs/reviews/full-review-2026-07-17.md`
  (25 confirmed findings incl. 2 P1). **Under-reviewed subsystems** needing a dedicated pass:
  hub mirroring/backfill (§2a/2b/2c/2e), PII/GDPR/consent, and layer a11y/big-view tests.

See also: `docs/reference/STATUS.md` (operator runbook), `CLAUDE.md` (standing rules),
`docs/reviews/full-review-2026-07-17.md` (this session's findings register).
