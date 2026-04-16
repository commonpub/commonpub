# CommonPub Codebase Analysis

This folder is the **raw, exhaustive inventory** of the CommonPub monorepo as of
session 125 (2026-04-16). Human docs in `docs/guides/` are derived from it; this
is the source of truth.

If you're a new contributor or an LLM loading context, read `facts.md` in
`docs/llm/` first — it's a condensed summary. Come here when you need the full
picture.

## Scope

CommonPub monorepo at `/Users/obsidian/Projects/ossuary-projects/commonpub/`.
Not to be confused with the stale `/Users/obsidian/Projects/commonpub/` directory.

## Snapshot

| | |
|---|---|
| Packages on npm | 12 (@commonpub/*) |
| Shared Nuxt layer | 1 (@commonpub/layer) |
| Apps | 2 (reference, shell) |
| Tools | 2 (create-commonpub Rust CLI, worker) |
| Tables in schema | 77 |
| Enums in schema | 41 |
| Zod validators | 50+ |
| Server modules | 20+ |
| API routes in layer | 257 |
| Layer pages | 85 |
| Layer components | 106 |
| Composables | 20 |
| Feature flags | 15 |
| Themes | 5 (base, dark, generics, agora, agora-dark) |
| Tests | 1,939+ (session 125 recent: 30/30 in focused subsets, 865 in wider runs) |

## Files

1. [`01-monorepo-topology.md`](./01-monorepo-topology.md) — Package graph, versions, workspace layout
2. [`02-schema-inventory.md`](./02-schema-inventory.md) — Every Drizzle table, enum, relation, validator
3. [`03-server-modules.md`](./03-server-modules.md) — `@commonpub/server` modules, public functions, tables touched
4. [`04-api-routes.md`](./04-api-routes.md) — All 257 REST endpoints in the layer
5. [`05-layer-pages-components.md`](./05-layer-pages-components.md) — Pages, components, composables, middleware
6. [`06-other-packages.md`](./06-other-packages.md) — config, auth, protocol, ui, editor, explainer, learning, docs, infra, test-utils
7. [`07-state-diagrams.md`](./07-state-diagrams.md) — Mermaid diagrams for contests, events, hubs, federation, auth
8. [`08-feature-flags-inventory.md`](./08-feature-flags-inventory.md) — All 15 flags, defaults, what each gates
9. [`09-gotchas-and-invariants.md`](./09-gotchas-and-invariants.md) — Drizzle CI failures, Nitro externalization, pnpm dist sync, etc.
10. [`10-doc-audit.md`](./10-doc-audit.md) — Which existing docs are fresh, stale, contradictory, missing
11. [`11-codebase-stats.md`](./11-codebase-stats.md) — Line counts, test counts, package sizes

## Regenerating

When the code changes substantially:

1. Re-run the Explore agents over `packages/schema`, `packages/server`, `layers/base`.
2. Diff new findings against these files; update in place.
3. Bump the "As of" date at the top of this README and in any changed files.

Don't generate from stale memory — re-read the code.
