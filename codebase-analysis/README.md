# CommonPub Codebase Analysis

> **Freshness as of session 169 (2026-05-30).** Each file is dated
> individually below. **Brought current in session 169** (layout-engine sweep):
> `02` (layout tables), `03` (layout server module), `04` (layout routes, ~300 total),
> `05` (layout components/composables + counts: 90 pages / 132 components / 33 composables),
> `08` (`layoutEngine` flag — live on commonpub.io via runtime override),
> `09` + `11` (dnd-kit provider-guard + in-container deploy-smoke gotchas).
> **Earlier — files brought current in session 150:**
>
> - `01-monorepo-topology.md` — version table only (headline still says session 125; structural shape unchanged)
> - `06-other-packages.md` — protocol + infra sections (other package sections still at session 125)
> - `08-feature-flags-inventory.md` — full flag list current (17 top-level + 5 nested `identity.*`)
> - `09-gotchas-and-invariants.md` — full session-150 invariants section appended; the factually-wrong "Redis is provisioned but unused" + "SSE streams are single-instance only" claims are now corrected (Redis wired in session 130; opt-in via `NUXT_REDIS_URL`)
> - `11-codebase-stats.md` — version table + session-churn table + headline counters current
> - `12-scaling-and-infrastructure.md` — anchored at session 130; reflects the Redis flip
>
> **Files still anchored at session 125 (2026-04-16) — read for
> structural shape, NOT for current state:**
>
> - `02-schema-inventory.md` — schema file list (missing `publicApi.ts`); enums table still useful; new tables since 125: federated_accounts + oauth-related additions in federation.ts; migrations 0003 + 0004 added
> - `03-server-modules.md` — directory map (missing: `identity/`, `publicApi/`, `realtime/` directories; `federation/mastodonLogin.ts`, `federation/safeFetchFn.ts`)
> - `04-api-routes.md` — route count was 257; current is ~284 (federated/Mastodon SSO + admin storage backfill + content import + public API routes added since)
> - `05-layer-pages-components.md` — page/component counts pre-identity-UI
> - `07-state-diagrams.md` — mermaid diagrams; pre-identity flow
> - `10-doc-audit.md` — itself stale
> - `13-architecture-patterns.md` — patterns are general; mostly still applicable
>
> For current state on these files: read the latest log in
> `docs/sessions/`, `docs/llm/facts.md` (refreshed session 150), and
> use `git log -p` against the package you care about for the
> authoritative recent change set. When the inventory in these files
> contradicts a recent session log, **trust the session log**.

This folder is the **raw, exhaustive inventory** of the CommonPub
monorepo, partially refreshed in session 150 (2026-05-19). Human docs
in `docs/guides/` are derived from it; this remains the source of
truth for structural shape (module boundaries, conventions, table
relationships) even where specific counts are stale.

If you're a new contributor or an LLM loading context, read `facts.md` in
`docs/llm/` first — it's a condensed summary. Come here when you need the full
picture.

## Scope

CommonPub monorepo at `/Users/obsidian/Projects/ossuary-projects/commonpub/`.
Not to be confused with the stale `/Users/obsidian/Projects/commonpub/` directory.

## Snapshot (session 150 refresh)

| | |
|---|---|
| Packages on npm | 12 (@commonpub/*) |
| Shared Nuxt layer | 1 (@commonpub/layer) |
| Apps | 2 (reference, shell) |
| Tools | 2 (create-commonpub Rust CLI, worker) |
| Tables in schema | 79 (migration 0004 added federated_accounts + oauth_codes) |
| Enums in schema | 41 |
| Zod validators | 50+ |
| Server modules | 22+ (added `identity/`, `publicApi/`, `realtime/`) |
| API routes in layer | ~284 (Mastodon login + federated SSO + admin storage backfill + content import + public read API + realtime stream) |
| Layer pages | 85+ |
| Layer components | 110+ |
| Composables | 20+ |
| Feature flags | 17 top-level + 5 nested `identity.*` sub-flags |
| Themes | 5 (base, dark, generics, agora, agora-dark) |
| Migrations | 5 (0000_session128_baseline → 0004_federated_oauth_tokens) |
| Production instances | 3 (commonpub.io, deveco.io, heatsynclabs.io — all auto-deploy from main) |
| Tests | ~3,200 (session 150: protocol 419, infra 305, server 967, layer 85, scaffolder cargo 27, others) |
| Latest versions | schema 0.16.0, server 2.55.0, config 0.13.0, layer 0.21.15, protocol 0.12.0, infra 0.8.0, ui 0.8.5, editor 0.7.10, explainer 0.7.15, learning 0.5.2, docs 0.6.3, auth 0.6.0, test-utils 0.5.6 |

## Files

1. [`01-monorepo-topology.md`](./01-monorepo-topology.md) — Package graph, versions, workspace layout
2. [`02-schema-inventory.md`](./02-schema-inventory.md) — Every Drizzle table, enum, relation, validator
3. [`03-server-modules.md`](./03-server-modules.md) — `@commonpub/server` modules, public functions, tables touched
4. [`04-api-routes.md`](./04-api-routes.md) — All 257 REST endpoints in the layer
5. [`05-layer-pages-components.md`](./05-layer-pages-components.md) — Pages, components, composables, middleware
6. [`06-other-packages.md`](./06-other-packages.md) — config, auth, protocol, ui, editor, explainer, learning, docs, infra, test-utils
7. [`07-state-diagrams.md`](./07-state-diagrams.md) — Mermaid diagrams for contests, events, hubs, federation, auth
8. [`08-feature-flags-inventory.md`](./08-feature-flags-inventory.md) — All 15 flags, defaults, what each gates
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
