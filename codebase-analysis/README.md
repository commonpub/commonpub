# CommonPub Codebase Analysis

> ⚠️ **Version/count tables drift every session — for LIVE ground truth read
> `docs/llm/facts.md` and `docs/llm/gotchas.md` FIRST, and `npm view @commonpub/<pkg>
> version` for exact versions.**

> **Full audit pass: session 181 (2026-06-01).** Every file in this folder was
> re-verified against the actual code in this session — counts, table/enum lists,
> module/route/component inventories, gotchas, and the doc audit are current as of
> session 181. Headline numbers below are recomputed from source (`grep`/`find`), not
> carried forward from memory. When the inventory here still contradicts a newer
> session log, **trust the session log** and re-run the regeneration steps at the bottom.
>
> Latest published versions (2026-06-01): **schema 0.25.0, server 2.72.0, config 0.16.0,
> layer 0.43.3, ui 0.9.2, protocol 0.12.0, auth 0.7.0, infra 0.8.0, editor 0.7.11,
> explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6.** 13 migrations
> (0000–0012). Keyset feed pagination (sessions 178–179), crafted-cursor DoS hardening +
> federated-leak fix (server 2.72.0, sessions 180–181), RBAC phase 0/1 (sessions 175–177),
> and base-layout chrome tokenization (session 180) are all live.

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

## Snapshot (session 181, 2026-06-01)

| | |
|---|---|
| Packages on npm | 12 (@commonpub/*) |
| Shared Nuxt layer | 1 (@commonpub/layer) |
| Apps | 2 (reference, shell) |
| Tools | 2 (create-commonpub Rust CLI, worker) |
| Tables in schema | 87 (`grep -c pgTable`) |
| Enums in schema | 42 (`grep -c pgEnum`) |
| Zod validators | 102 `*Schema` exports in `validators.ts` |
| Server modules | 25 module dirs + 11 top-level utility files |
| API routes in layer | 311 files under `server/api/` + 22 ActivityPub/site files under `server/routes/` |
| Layer pages | 90 |
| Layer components | 135 |
| Composables | 34 (non-test; +12 `__tests__/` files) |
| Route middleware | 3; server (Nitro) middleware 11; server plugins 8 |
| Feature flags | 19 boolean top-level + `identity` object (5 sub-flags) |
| Themes | 5 built-in (base, dark, generics, agora, agora-dark) + DB-stored + code-registered |
| Migrations | 14 (0000_session128_baseline → 0013_black_lorna_dane = self-ref FKs, session 183; 0013 is on the `feat/federation-discovery-and-hardening` branch, not yet published/deployed) |
| Production instances | 3 (commonpub.io, deveco.io, heatsynclabs.io — all auto-deploy from main) |
| Tests | 265 git-tracked `*.test.ts` files (server 80, layer 42, ui 27, protocol 27, editor 24, infra 11, docs 11, explainer 9, apps/reference 9, schema 7, auth 7, learning 5, deploy 3, config 1, test-utils 1, tools/worker 1) |
| Latest versions | schema 0.25.0, server 2.72.0, config 0.16.0, layer 0.43.3, ui 0.9.2, auth 0.7.0, protocol 0.12.0, infra 0.8.0, editor 0.7.11, explainer 0.7.15, learning 0.5.2, docs 0.6.3, test-utils 0.5.6 (verify with `npm view`) |

## Files

1. [`01-monorepo-topology.md`](./01-monorepo-topology.md) — Package graph, versions, workspace layout
2. [`02-schema-inventory.md`](./02-schema-inventory.md) — Every Drizzle table, enum, relation, validator
3. [`03-server-modules.md`](./03-server-modules.md) — `@commonpub/server` modules, public functions, tables touched
4. [`04-api-routes.md`](./04-api-routes.md) — REST endpoints (311 `server/api/` files) + 22 ActivityPub/site routes
5. [`05-layer-pages-components.md`](./05-layer-pages-components.md) — Pages, components, composables, middleware
6. [`06-other-packages.md`](./06-other-packages.md) — config, auth, protocol, ui, editor, explainer, learning, docs, infra, test-utils
7. [`07-state-diagrams.md`](./07-state-diagrams.md) — Mermaid diagrams for contests, events, hubs, federation, auth
8. [`08-feature-flags-inventory.md`](./08-feature-flags-inventory.md) — All 19 boolean flags + `identity.*` sub-flags, defaults, what each gates
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
