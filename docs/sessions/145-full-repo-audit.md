# Session 145 — Full-repo audit + fixes

Date: 2026-05-17. Branch: `main`. **Fixes applied + verified locally;
NOT yet committed/published/deployed (paused for go-ahead).**

## Method

Maximum-depth audit via 5 parallel research subagents (packages /
layer+apps UI/UX / server+federation / Rust CLI+CI / docs-accuracy) +
self-run gates. Every agent finding re-verified against source before
acceptance (audits produce false positives).

## Gates (all green)

- typecheck 26/26 · lint 0 · cargo 26/26
- tests: server 964/3skip, protocol 375, editor 230, ui 217, docs 131
- drizzle-kit check + generate: **no schema/migration drift** (count 5)
- pathPrefix component-resolution sweep: **0 unresolved** (389
  components / 199 .vue files) — no silently-empty component class
- darwin `sharp-wasm32` ENOENT in reference/shell `build` = known
  local flake, not a real failure (CI/linux authoritative)

## Fixed (A1–A8) — verified

All layer fixes (A1–A4) → **@commonpub/layer republish required**.
A5–A8 are repo-only (workflows + docs), no npm publish.

- **A1 [HIGH]** `components/homepage/HomepageSectionRenderer.vue:24` —
  `isFeatureEnabled()` indexed the `features` *Ref object* instead of
  `.value`, so every `featureGate` resolved `undefined ?? true` →
  always-on. Contests/hubs/editorial homepage sections rendered even
  when their flag was off (standing rule #2 violation). Fix: `.value`.
  **Regression test added**: `components/__tests__/HomepageSectionRenderer.test.ts`
  (2 tests; fails against pre-fix code).
- **A2 [HIGH a11y]** `components/ShareToHubModal.vue` — overlay modal
  with zero a11y. Wired `useFocusTrap` (local `visible` ref flipped
  `onMounted` since the parent v-if-mounts it) + `role=dialog`
  `aria-modal` `aria-labelledby`.
- **A3 [MED]** hardcoded `font-family: system-ui,...` → `var(--font-sans)`
  in `SearchFilters.vue:159`, `pages/search.vue:515`,
  `pages/u/[username]/index.vue:682` (hard CLAUDE.md rule).
- **A4 [LOW]** `error.vue:128` bare `color:#fff` →
  `var(--color-text-inverse, #fff)` (matches the file's fallback pattern).
- **A5 [HIGH sec]** `.github/workflows/server-cmd.yml` — raw
  `${{ inputs.command }}` in root SSH script (GHA-expression injection).
  Now passed via `env:`/`envs:` (operator RCE-by-design retained,
  injection class closed).
- **A6 [HIGH sec]** `.github/workflows/admin-promote.yml` — username
  concatenated into `psql` SQL. Now `env:` + `^[A-Za-z0-9_]+$`
  validation + psql `:'u'` binding.
- **A7 [LOW]** `deploy.yml:54` — dropped stale `--config=drizzle.config.js`
  arg (`db-migrate.mjs` ignores args).
- **A8 [MED]** docs accuracy: `CLAUDE.md:9` dead plan path → archived
  path; `README.md` version table (5–11 minors stale) + metrics
  (routes 257→283, pages 85→86, composables 20→22, flags 15→16+5,
  schema "77"→79 tables) corrected to verified counts; `CHANGELOG.md`
  Unreleased range 142→144 + sessions 143/144 entries added;
  `docs/README.md:35` "108–125"→"108–144".

## New finding — NOT fixed (needs your call)

- **[MED] Layer test suite is not in the CI gate.**
  `layers/base/package.json` has no `test` script, so `turbo run test`
  (`pnpm test`) silently skips all 47 layer vitest tests — including
  **2 currently-red** ones (`composables/__tests__/useMirrorContent.test.ts`
  "falls back to 'article'…" and `components/__tests__/FederatedContentCard.test.ts`
  "shows 'article' for AP Article…"). Both assert the legacy
  `'article'` value the code *correctly* normalizes to `'blog'`
  (session-116 invariant). Pre-existing, unrelated to this session's
  edits. Fixing the assertions presupposes the article→blog
  authoritative decision (see below) — deferred to that decision.
  Recommend: make the decision, fix the 2 tests, add
  `"test": "vitest run"` to the layer package + wire into turbo.

## Deferred / needs-your-call (see report)

SSRF cluster (unauth amplification on `federation/remote-actor.get.ts`
& `search.post.ts`; `content/import.post.ts` no flag; unguarded raw
`fetch` in `hubMirroring.ts:189/1172/1461`) — all bounded by topology
(`features.federation` off in prod) + the deferred DNS-rebind class;
needs a dedicated SSRF session (undici pinned-lookup dispatcher) +
product decision. `auto-admin` first-mover race (known-deferred).
Avatar dropdown a11y. feed/index error-vs-empty state.
protocol/server `isPrivateUrl` divergence (not a live hole — verified).
`auth/createAuth` return type. `hubMirroring.ts:113` silent catch.
`deploy.yml` no-rollback-after-force-recreate. `ci.yml:147` e2e
drizzle-kit push. `BlogEditor.vue:526` Arial. `article` content-type
contradiction across CLAUDE.md#6 / README / federation.md /
public-api.md (needs one authoritative statement).

## Verified-clean (do not re-flag)

tokenCrypto (fresh IV/call, AEAD, tested), publicApi serializers
(allow-list intact), explainer v-html (8/8 sanitized), quiz redaction,
no circular deps, all exports maps resolve, schema↔migration clean,
204-fallthrough / admin-auth / messages+draft IDOR-scoping invariants
hold, session-144 mobile fixes coherent + no desktop regression.

## Release / deploy plan (PENDING GO-AHEAD)

Only `@commonpub/layer` republishes: **0.21.4 → 0.21.5** (patch).
No other package, no schema, migration count unchanged (5).

Order: (1) bump `layers/base/package.json` 0.21.5 + commit fix/release;
(2) `pnpm --filter=@commonpub/layer publish`; (3) poll
`npm view @commonpub/layer@0.21.5 version` until propagated;
(4) bump `tools/create-commonpub/src/template.rs`
`COMMONPUB_LAYER_VERSION ^0.21.4→^0.21.5` + `tests/cli.rs` exact-pin +
`cargo build`/`cargo test`; (5) deveco.io + heatsynclabs.io bump
`@commonpub/layer` to `^0.21.5` (separate install command, real exit
code, refresh lockfile); commonpub.io builds from source on push.
HeatSync shadows only `SiteLogo.vue` + `HeroSection.vue` — none of
A1–A4 touch those, so the layer bump fully propagates. Leave
heatsync's uncommitted `commonpub.config.ts` + untracked
`ONBOARDING.md` untouched (scoped `git add` only).

## Open questions

1. Article→blog: adopt "`article` is a deprecated alias normalizing to
   `blog`" as the single authoritative statement (propagate to
   CLAUDE.md#6, README, federation.md, public-api.md) and fix the 2
   stale layer tests + wire the layer suite into the gate?
2. Schedule a dedicated SSRF-hardening session (undici pinned-lookup
   dispatcher + decision on public unauth actor lookup)?
