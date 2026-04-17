# 01 — Monorepo Topology

As of session 125 (2026-04-16).

## Repo shape

```
commonpub/
├── apps/
│   ├── reference/         @commonpub/reference — full-featured Nuxt 3 dogfood app (extras: drizzle.config, e2e/, seed scripts)
│   └── shell/             @commonpub/shell     — plain starter template (same feature flags, smaller file set)
├── layers/
│   └── base/              @commonpub/layer     — shared Nuxt layer (the distribution unit)
├── packages/              12 framework-agnostic TS packages (all published to npm)
│   ├── auth/              @commonpub/auth
│   ├── config/            @commonpub/config
│   ├── docs/              @commonpub/docs
│   ├── editor/            @commonpub/editor
│   ├── explainer/         @commonpub/explainer
│   ├── infra/             @commonpub/infra
│   ├── learning/          @commonpub/learning
│   ├── protocol/          @commonpub/protocol
│   ├── schema/            @commonpub/schema
│   ├── server/            @commonpub/server
│   ├── test-utils/        @commonpub/test-utils
│   └── ui/                @commonpub/ui
├── tools/
│   ├── create-commonpub/  Rust CLI scaffolder (published to crates.io)
│   └── worker/            Activity delivery monitoring utilities
├── deploy/                Docker Compose, Caddyfile, DO app-spec, deploy scripts
├── design-system-v2/      ARCHIVE. Figma HTML exports. Not used at runtime.
├── docs/                  Human docs, ADRs, session logs, reference material
├── test-site/             Separate Nuxt instance for integration testing (npm-locked, legacy)
├── scripts/               db-migrate.mjs (CI schema applier), db-push.mjs (legacy dev), migrate-blog-to-article.sql
├── Dockerfile             Multi-stage, node:22-alpine, non-root, healthcheck
├── docker-compose.yml     Local dev (Postgres, Redis, Meilisearch on non-default ports)
├── turbo.json             build/dev/test/lint/typecheck pipelines
├── pnpm-workspace.yaml    packages/*, layers/*, apps/*, tools/worker, deploy
└── CHANGELOG.md           LAST RELEASE: v0.2.0 (2026-03-23) — significantly behind current state
```

Note: `tools/create-commonpub` is NOT in the pnpm workspace — it's Rust.

## Published package versions (2026-04-16)

| Package | Version | Notes |
|---|---|---|
| @commonpub/schema | 0.13.0 | Session 124 added events, voting, contestJudges |
| @commonpub/server | 2.43.0 | Bumped on most sessions |
| @commonpub/config | 0.10.0 | 15 feature flags |
| @commonpub/layer | 0.15.3 | Bumped in session 126 for typecheck fixes; also consumed via workspace |
| @commonpub/ui | 0.8.5 | Independent; NOT bundled into layer |
| @commonpub/protocol | 0.9.9 | Pure-TS ActivityPub: AP types, content mapper, WebFinger, NodeInfo, HTTP signatures (jose), OAuth2 helpers |
| @commonpub/editor | 0.7.9 | 20 block types |
| @commonpub/explainer | 0.7.11 | Pure TS engine + optional Vue |
| @commonpub/learning | 0.5.0 | Curriculum engine |
| @commonpub/docs | 0.6.2 | Search adapters |
| @commonpub/auth | 0.5.1 | Better Auth wrapper + AP SSO |
| @commonpub/infra | 0.5.1 | Storage / image / email / security |
| @commonpub/test-utils | 0.5.3 | Factories + mock config |

Root `package.json` version: `0.15.2`.

## Dependency graph (core → leaf)

```
┌───────────────────────────────────────────────┐
│ apps/reference  apps/shell                    │  <- thin shells
│        │              │                        │
│        └──────┬───────┘                        │
│               ▼                                │
│        @commonpub/layer (layers/base)          │  <- distribution unit
│               │                                │
│   ┌───────────┼───────────┬────────────┐       │
│   ▼           ▼           ▼            ▼       │
│ server    auth+protocol  editor    infra       │  <- business logic + utilities
│   │           │           │            │       │
│   └───────────┼───────────┴────────────┘       │
│               ▼                                │
│          config + schema                       │  <- foundation
└───────────────────────────────────────────────┘

explainer → editor → config + schema
learning  → explainer + editor → ...
docs      → config + schema
ui        (standalone, no dep on other @commonpub packages)
test-utils → config + schema
```

**Rules:**
- `config` + `schema` are foundational. Nothing else depends on apps.
- `ui` is fully decoupled — no cross-package deps.
- Apps depend on the layer. Layer depends on everything below.
- The layer bundles its CSS; consumers DO NOT import UI CSS manually.
- `@commonpub/ui` is published but treat it as a component library separate from the layer. The layer already has its own components under `layers/base/components/`.

## Workspace script entry points

From `package.json` at root:

| Script | What it does |
|---|---|
| `pnpm install` | Install all workspaces |
| `pnpm build` | Turbo-runs build in every package |
| `pnpm dev` | Turbo-runs dev in every package |
| `pnpm dev:app` | `@commonpub/reference` only |
| `pnpm dev:infra` | `docker compose up -d` (Postgres, Redis, Meilisearch) |
| `pnpm --filter=@commonpub/schema db:generate` | Create SQL migration from schema edits (TTY required) |
| `pnpm --filter=@commonpub/schema db:migrate` | Apply committed migrations (what CI deploys run) |
| `pnpm --filter=@commonpub/schema db:push` | Push schema directly (local dev iteration only) |
| `pnpm test` | All vitest suites |
| `pnpm test:e2e` | Playwright |
| `pnpm lint` / `typecheck` | Turbo pipelines |
| `pnpm publish:check` | build + typecheck + test |
| `pnpm publish:all` | `pnpm -r --filter './packages/*' publish --no-git-checks` |
| `pnpm stryker` | Mutation testing (all packages) |

Per-package mutation: `pnpm stryker:infra` / `:schema` / `:protocol` / `:editor` / `:server`.

## Thin-app pattern

The "minimum viable CommonPub instance" is ~4 files + `.env`:

```
my-site/
├── nuxt.config.ts            # extends: ['@commonpub/layer']
├── commonpub.config.ts       # defineCommonPubConfig({ features, auth, instance })
├── server/utils/config.ts    # Nitro-side config resolver (env + DB override layers)
└── components/SiteLogo.vue   # branded logo
```

`apps/shell/` is the canonical starter. `apps/reference/` is the fully featured reference.

Real deployments: **deveco.io** (~25 branded/config files extending the layer — overrides app.vue + error.vue + 2 layouts, adds a DevEcoLogo, 4 custom pages/overrides, its own Dockerfile + Caddyfile + 2 docker-composes, 2 drizzle configs, 4 GitHub Actions workflows, server/utils/config.ts, and the usual commonpub.config.ts + nuxt.config.ts + package.json + tsconfig.json).

## What changes where

| Change type | Where to edit |
|---|---|
| Add DB table / column | `packages/schema/src/*.ts` → `pnpm db:generate` → commit SQL |
| Add server function | `packages/server/src/<domain>/*.ts` + export from `<domain>/index.ts` |
| Add API route | `layers/base/server/api/<path>.<method>.ts` |
| Add page | `layers/base/pages/<path>.vue` |
| Add component | `layers/base/components/<Name>.vue` |
| Add feature flag | `packages/config/src/types.ts` + `schema.ts` + commonpub.config.ts in apps + gate in server/layer |
| Branding / theme | Consumer app `assets/theme.css` (CSS custom properties) |
| AP type / federation logic | `packages/protocol/src/*.ts` |

## Stale directories to ignore

- `/Users/obsidian/Projects/commonpub/` (frozen, older fork)
- `/Users/obsidian/Projects/deveco/deveco-io/` (frozen, older fork)
- `design-system-v2/` — Figma HTML snapshots, not used at runtime

## Turbo pipeline

From `turbo.json`:

- `build`: depends on upstream builds, outputs `dist/**`, `.output/**`, `.nuxt/**`
- `dev`: no cache, persistent
- `test`: depends on build, no cache
- `lint` / `typecheck`: depend on upstream builds
- `clean`: no cache

Caching is keyed on source + config. If `pnpm install` didn't update a dep, builds are cached.
