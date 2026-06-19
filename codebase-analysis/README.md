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
> **Counts/versions refreshed session 203 (2026-06-18)** — see `docs/sessions/203-full-codebase-audit.md`
> for the findings report. For LIVE versions/flags defer to `docs/STATUS.md` (the tables below drift).
> Latest published versions (2026-06-18): **schema 0.45.0, server 2.89.0, config 0.22.1,
> layer 0.82.0, ui 0.13.1, theme-studio 0.6.1, protocol 0.13.0, auth 0.8.0, infra 0.8.0, editor 0.7.12,
> explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6.** 26 migrations
> (0000–0025). RBAC activation + per-contest editors (session 201), scheduled publishing + field-drop
> fixes + terms (sessions 199–200), Theme Studio advanced tokens/glass (sessions 192–195), contest
> per-stage submissions (session 194), search/nav/theme-identity (session 196), public API metrics +
> CORS + time-series (session 190), contest stages / cohorts / per-round judging (session 189),
> federation discovery + registry + mirror-requests (sessions 183–188), keyset feed pagination
> (sessions 178–179) are all live.

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

## Snapshot (counts refreshed session 203, 2026-06-18)

| | |
|---|---|
| Packages on npm | 13 (@commonpub/* incl. `theme-studio`, published since session 192) |
| Shared Nuxt layer | 1 (@commonpub/layer) |
| Apps | 2 (reference, shell) |
| Tools | 2 (create-commonpub Rust CLI, worker) |
| Tables in schema | 90 (`grep -c pgTable`) |
| Enums in schema | 46 (`grep -c pgEnum`) |
| Zod validators | 118 `*Schema` exports in `validators.ts` (1254 LOC) |
| Server modules | 26 module dirs + 11 top-level utility files |
| API routes in layer | 338 files under `server/api/` (332 handlers + 6 `__tests__/` files) + 22 ActivityPub/site files under `server/routes/` |
| Layer pages | 92 |
| Layer components | 144 |
| Composables | 35 (non-test; +13 `__tests__/` files) |
| Route middleware | 3; server (Nitro) middleware 11; server plugins 11 |
| Feature flags | 24 boolean top-level + `identity` object (5 sub-flags) + `auth` (3 sub-flags) |
| Themes | 7 built-in (base, dark, generics, agora, agora-dark, stoa, stoa-dark — stoa is the default) + DB-stored + code-registered |
| Migrations | 26 (0000_session128_baseline → 0025_round_malice = `contest_stakeholders.role` + RBAC seed, session 201; all published/deployed) |
| Production instances | 3 (commonpub.io, deveco.io, heatsynclabs.io — all auto-deploy from main) |
| Tests | 304 git-tracked `*.test.ts` files (`git ls-files '*.test.ts'`) |
| Latest versions | schema 0.45.0, server 2.89.0, config 0.22.1, layer 0.82.0, ui 0.13.1, theme-studio 0.6.1, auth 0.8.0, protocol 0.13.0, infra 0.8.0, editor 0.7.12, explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6 (verify with `npm view`; defer to `docs/STATUS.md`) |

## Files

1. [`01-monorepo-topology.md`](./01-monorepo-topology.md) — Package graph, versions, workspace layout
2. [`02-schema-inventory.md`](./02-schema-inventory.md) — Every Drizzle table, enum, relation, validator
3. [`03-server-modules.md`](./03-server-modules.md) — `@commonpub/server` modules, public functions, tables touched
4. [`04-api-routes.md`](./04-api-routes.md) — REST endpoints (338 `server/api/` files) + 22 ActivityPub/site routes
5. [`05-layer-pages-components.md`](./05-layer-pages-components.md) — Pages, components, composables, middleware
6. [`06-other-packages.md`](./06-other-packages.md) — config, auth, protocol, ui, theme-studio, editor, explainer, learning, docs, infra, test-utils
7. [`07-state-diagrams.md`](./07-state-diagrams.md) — Mermaid diagrams for contests, events, hubs, federation, auth
8. [`08-feature-flags-inventory.md`](./08-feature-flags-inventory.md) — All 24 boolean flags + `identity.*`/`auth.*` sub-flags, defaults, what each gates
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
