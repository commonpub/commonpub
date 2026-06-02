# 01 — Monorepo Topology

Structural shape and published-version table re-verified session 181
(2026-06-01). Module boundaries and the dependency graph below are
unchanged since the original mapping (session 125).

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
├── scripts/               db-migrate.mjs (CI schema applier), db-push.mjs (legacy dev), migrate-homepage-layout.mjs, smoke.mjs (deploy smoke), migrate-blog-to-article.sql
├── Dockerfile             Multi-stage, node:22-alpine, non-root, healthcheck
├── docker-compose.yml     Local dev (Postgres, Redis, Meilisearch on non-default ports)
├── turbo.json             build/dev/test/lint/typecheck pipelines
├── pnpm-workspace.yaml    packages/*, layers/*, apps/*, tools/worker, deploy
└── CHANGELOG.md           "Unreleased" block runs through ~session 160; still behind per-package npm versions
```

Note: `tools/create-commonpub` is NOT in the pnpm workspace — it's Rust.

## Published package versions (2026-06-01, session 181)

| Package | Version | Notes |
|---|---|---|
| @commonpub/schema | 0.25.0 | 87 tables, 42 enums, 13 migrations (0000–0012); RBAC tables (`roles`/`role_permissions`/`user_roles`, 0009), contest visibility/eligibility (0006–0008), composite feed indexes (0012) |
| @commonpub/server | 2.72.0 | Crafted-cursor DoS hardening + federated-leak fix (2.72.0); keyset feed pagination `listContentKeyset` (2.70.0+); RBAC resolver; federation outbound through SSRF-safe path |
| @commonpub/config | 0.16.0 | 19 boolean top-level flags + nested `identity.*` (5 sub-flags); `layoutEngine` + `rbac` flags added |
| @commonpub/layer | 0.43.3 | Keyset feed (`useContentFeed`, `GET /api/content/feed`); chrome tokenization; config-driven nav (NavRenderer) |
| @commonpub/ui | 0.9.2 | Independent; NOT bundled into layer; `BUILT_IN_THEMES` (5) + token split |
| @commonpub/protocol | 0.12.0 | Pure-TS ActivityPub; `safeFetchResponse`+`safeFetchSigned`; strict `verifyHttpSignature` coverage + raw-body digest |
| @commonpub/editor | 0.7.11 | 20 block types (18 TipTap extension files) |
| @commonpub/explainer | 0.7.15 | Pure TS engine + Vue (top-level `vue/` dir); cover-image upload UI |
| @commonpub/learning | 0.5.2 | Curriculum + progress + quiz + certificate engines |
| @commonpub/docs | 0.6.3 | Search adapters (Meilisearch + Postgres FTS fallback) |
| @commonpub/auth | 0.7.0 | Better Auth wrapper + AP SSO + cross-instance identity types + `hasPermissionPure` (RBAC) |
| @commonpub/infra | 0.8.0 | Storage / image / email / security; `getClientIp`; DO Spaces CDN derivation; Redis + realtime pub/sub |
| @commonpub/test-utils | 0.5.6 | Auth/session/federated-account/OAuth-client factories + `createTestConfig` |

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

- `build`: depends on upstream builds, outputs `dist/**`, `build/**`, `.output/**`, `.nuxt/**`
- `dev`: no cache, persistent
- `test`: depends on build, no cache
- `lint` / `typecheck`: depend on upstream builds
- `clean`: no cache

Caching is keyed on source + config. If `pnpm install` didn't update a dep, builds are cached.
