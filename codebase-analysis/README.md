# CommonPub Codebase Analysis

> ⚠️ **Version/count tables drift every session — for LIVE ground truth read
> `docs/llm/facts.md` and `docs/llm/gotchas.md` FIRST, and `npm view @commonpub/<pkg>
> version` for exact versions.**

> **Full audit pass: session 191 (2026-06-07).** Every file in this folder was
> re-verified against the actual code — counts, table/enum lists, migration DDL,
> module/route/component inventories, gotchas, feature flags, and the doc audit are
> current as of session 191. Headline numbers below are recomputed from source
> (`grep`/`find`/`git ls-files`), not carried forward from memory. This pass folded in
> the work of sessions 189 (contest stages) and 190 (public-API metrics + Stoa theme),
> which the prior session-188 refresh predated. When the inventory here still contradicts
> a newer session log, **trust the session log** and re-run the regeneration steps at the
> bottom. Operator-facing current state lives in `docs/STATUS.md`.
>
> Latest published versions (2026-06-07): **schema 0.35.0, server 2.82.0, config 0.19.0,
> layer 0.64.1, ui 0.11.1, protocol 0.13.0, auth 0.8.0, infra 0.8.0, editor 0.7.11,
> explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6.** 21 migrations
> (0000–0020). Public API metrics + flexible CORS + time-series rollups (session 190),
> Stoa default theme (session 190), contest stages / cohorts / per-round judging
> (session 189), federation discovery + registry + mirror-requests (sessions 183–188),
> keyset feed pagination (sessions 178–179), and RBAC phase 0/1 (sessions 175–177) are
> all live.

This folder is the **raw, exhaustive inventory** of the CommonPub
monorepo. Human docs in `docs/guides/` are derived from it; this remains the
source of truth for structural shape (module boundaries, conventions, table
relationships) and current counts.

If you're a new contributor or an LLM loading context, read `facts.md` in
`docs/llm/` first — it's a condensed summary. Come here when you need the full
picture.

## Scope

CommonPub monorepo at `/Users/obsidian/Projects/ossuary-projects/commonpub/`.
Not to be confused with the stale `/Users/obsidian/Projects/commonpub/` directory.

## Snapshot (session 191, 2026-06-07)

| | |
|---|---|
| Packages on npm | 12 (@commonpub/*) + `theme-studio` built but unpublished (session 192) = 13 total |
| Shared Nuxt layer | 1 (@commonpub/layer) |
| Apps | 2 (reference, shell) |
| Tools | 2 (create-commonpub Rust CLI, worker) |
| Tables in schema | 90 (`grep -c pgTable`) |
| Enums in schema | 45 (`grep -c pgEnum`) |
| Zod validators | 111 `*Schema` exports in `validators.ts` |
| Server modules | 25 module dirs + 11 top-level utility files |
| API routes in layer | 327 files under `server/api/` (321 handlers + 6 colocated tests) + 22 ActivityPub/site files under `server/routes/` |
| Layer pages | 90 |
| Layer components | 141 (session 192: +AdminThemeStudio, +AdminThemeSceneSheet) |
| Composables | 34 (non-test; +12 `__tests__/` files) |
| Route middleware | 3; server (Nitro) middleware 11; server plugins 10 |
| Feature flags | 23 boolean top-level (+`themeStudio` session 192) + `identity` object (5 sub-flags) |
| Themes | 7 built-in (base, dark, generics, agora, agora-dark, stoa, stoa-dark — stoa is the default) + DB-stored + code-registered |
| Migrations | 21 (0000_session128_baseline → 0020_spooky_gideon = `metrics_daily`, session 190; all published/deployed) |
| Production instances | 3 (commonpub.io, deveco.io, heatsynclabs.io — all auto-deploy from main) |
| Tests | 290 git-tracked `*.test.ts` files (server 91, layer 50, ui 27, protocol 27, editor 24, infra 11, docs 11, explainer 9, apps/reference 9, theme-studio 6, schema 7, auth 7, learning 5, deploy 3, config 1, test-utils 1, tools/worker 1) |
| Latest versions | schema 0.35.0, server 2.82.0, config 0.19.0, layer 0.64.1, ui 0.11.1, auth 0.8.0, protocol 0.13.0, infra 0.8.0, editor 0.7.11, explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6 (verify with `npm view`) |

## Files

1. [`01-monorepo-topology.md`](./01-monorepo-topology.md) — Package graph, versions, workspace layout
2. [`02-schema-inventory.md`](./02-schema-inventory.md) — Every Drizzle table, enum, relation, validator
3. [`03-server-modules.md`](./03-server-modules.md) — `@commonpub/server` modules, public functions, tables touched
4. [`04-api-routes.md`](./04-api-routes.md) — REST endpoints (327 `server/api/` files) + 22 ActivityPub/site routes
5. [`05-layer-pages-components.md`](./05-layer-pages-components.md) — Pages, components, composables, middleware
6. [`06-other-packages.md`](./06-other-packages.md) — config, auth, protocol, ui, theme-studio, editor, explainer, learning, docs, infra, test-utils
7. [`07-state-diagrams.md`](./07-state-diagrams.md) — Mermaid diagrams for contests, events, hubs, federation, auth
8. [`08-feature-flags-inventory.md`](./08-feature-flags-inventory.md) — All 22 boolean flags + `identity.*` sub-flags, defaults, what each gates
9. [`09-gotchas-and-invariants.md`](./09-gotchas-and-invariants.md) — Migrate-based schema deploys, Nitro externalization, pnpm dist sync, useState key collisions, etc.
10. [`10-doc-audit.md`](./10-doc-audit.md) — Which existing docs are fresh, stale, contradictory, missing
11. [`11-codebase-stats.md`](./11-codebase-stats.md) — Line counts, test counts, package sizes
12. [`12-scaling-and-infrastructure.md`](./12-scaling-and-infrastructure.md) — What breaks first under load, Fedify/Redis analysis, DigitalOcean-specific scaling path
13. [`13-architecture-patterns.md`](./13-architecture-patterns.md) — Recommended architecture for a site like this: per-route rendering matrix, queue pattern, cache layers, anti-patterns, TL;DR stack

## Regenerating

When the code changes substantially:

1. Re-run the Explore agents over `packages/schema`, `packages/server`, `layers/base`.
2. Diff new findings against these files; update in place.
3. Bump the "As of" date at the top of this README and in any changed files.

Don't generate from stale memory — re-read the code.
