# 01 — Monorepo Topology

Structural shape verified session 191; version table refreshed session 203
(2026-06-18). Module boundaries and the dependency graph below are
unchanged since the original mapping (session 125) — confirmed clean (no cycles,
no inverted deps) in the session-203 audit.

## Repo shape

```
commonpub/
├── apps/
│   ├── reference/         @commonpub/reference — full-featured Nuxt 3 dogfood app (extras: drizzle.config, e2e/, seed scripts)
│   └── shell/             @commonpub/shell     — plain starter template (same feature flags, smaller file set)
├── layers/
│   └── base/              @commonpub/layer     — shared Nuxt layer (the distribution unit)
├── packages/              13 framework-agnostic TS packages (12 published to npm; theme-studio new/unpublished)
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
│   ├── theme-studio/      @commonpub/theme-studio  — pure-TS theme generator (published since session 192)
│   └── ui/                @commonpub/ui
├── tools/
│   ├── create-commonpub/  Rust CLI scaffolder (published to crates.io)
│   └── worker/            Activity delivery monitoring utilities
├── deploy/                Docker Compose, Caddyfile, DO app-spec, deploy scripts
├── design-system-v2/      ARCHIVE. Figma HTML exports. Not used at runtime.
├── docs/                  Human docs, ADRs, session logs, reference material
├── test-site/             Separate Nuxt instance for integration testing (npm-locked, legacy)
├── scripts/               db-migrate.mjs (CI schema applier), db-push.mjs (legacy dev), migrate-homepage-layout.mjs, reconcile-counters.mjs (counter recount/repair), smoke.mjs (deploy smoke), migrate-blog-to-article.sql
├── Dockerfile             Multi-stage, node:22-alpine, non-root, healthcheck
├── docker-compose.yml     Local dev (Postgres, Redis, Meilisearch on non-default ports)
├── turbo.json             build/dev/test/lint/typecheck pipelines
├── pnpm-workspace.yaml    packages/*, layers/*, apps/*, tools/worker, deploy
└── CHANGELOG.md           "Unreleased" block runs through ~session 160; still behind per-package npm versions
```

Note: `tools/create-commonpub` is NOT in the pnpm workspace — it's Rust.

## Published package versions (version cells refreshed session 203, 2026-06-18)

> ⚠️ Version numbers drift every release — **defer to `docs/STATUS.md` + `npm view` for LIVE**.
> The Notes cells are a session-191 capability snapshot (still broadly accurate); versions
> below are corrected to the session-203 published set.

| Package | Version | Notes |
|---|---|---|
| @commonpub/schema | 0.45.0 | 90 tables, 46 enums, 26 migrations (0000–0025); RBAC role seed + `contest_stakeholders.role` (0025), scheduled publishing (`scheduled_at`, 0024), per-field contest text formats (0023), contest stage submissions (0021), `metrics_daily` (0020), contest stages/cohorts (0016–0019), mirror requests (0014) + registry instances (0015), RBAC tables (0009), composite feed indexes (0012) |
| @commonpub/server | 2.89.0 | RBAC resolver + seed (`rbac/admin.ts`,`seed.ts`); contest stage engine + per-stage artifacts; scheduled-publish worker; public-API metrics + CORS; federation registry + mirror requests; keyset feed; SSRF-safe outbound |
| @commonpub/config | 0.22.1 | 24 boolean top-level flags + nested `identity.*` (5) + `auth.*`; `contestStageSubmissions` (0.21), `themeStudio` (0.20), `publicApiMetricsFederation` (0.19), `actAsRegistry`/`announceToRegistry`, `layoutEngine`, `rbac` |
| @commonpub/layer | 0.82.0 | RBAC `/admin/roles` UI + `useCan`; image cropper; scheduled-publish UI; Theme Studio wizard + advanced/glass tokens; search/nav/theme-identity; contest stage editors; keyset feed |
| @commonpub/ui | 0.13.1 | Independent; NOT bundled into layer; Stoa theme family; `BUILT_IN_THEMES` (7) + TOKEN_SPECS chrome/treatment token split |
| @commonpub/protocol | 0.13.0 | Pure-TS ActivityPub; `safeFetchResponse`+`safeFetchSigned`; strict `verifyHttpSignature` coverage + raw-body digest; registry/discovery types |
| @commonpub/editor | 0.7.12 | 20 block types (18 TipTap extension files) |
| @commonpub/explainer | 0.7.15 | Pure TS engine + Vue (top-level `vue/` dir); cover-image upload UI |
| @commonpub/learning | 0.5.2 | Curriculum + progress + quiz + certificate engines |
| @commonpub/docs | 0.6.3 | Search adapters (Meilisearch + Postgres FTS fallback) |
| @commonpub/auth | 0.8.0 | Better Auth wrapper + AP SSO + cross-instance identity types + `hasPermissionPure` (RBAC) |
| @commonpub/infra | 0.8.0 | Storage / image / email / security; `getClientIp`; DO Spaces CDN derivation; Redis + realtime pub/sub |
| @commonpub/test-utils | 0.5.6 | Auth/session/federated-account/OAuth-client factories + `createTestConfig` |
| @commonpub/theme-studio | 0.6.1 | Pure-TS theme generator (published since session 192). `recipeToTokens()` projection + color/palette/scales/fonts/presets + glass/advanced tokens. No runtime deps. Consumed by the layer's Theme Studio wizard. |

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
ui          (standalone, no dep on other @commonpub packages)
theme-studio (standalone, no runtime deps; layer → theme-studio)
test-utils → config + schema
```

**Rules:**
- `config` + `schema` are foundational. Nothing else depends on apps.
- `ui` and `theme-studio` are fully decoupled — no cross-package runtime deps. The layer depends on both.
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
