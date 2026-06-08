# `@commonpub/reference`

The Nuxt 3 reference application — a thin shell that wires `@commonpub/layer` together with an instance configuration. This is the app that powers `commonpub.io` and every reference deployment; it's also the template a new operator's instance is scaffolded from (via `create-commonpub`).

## What lives here

| Path | Purpose |
|---|---|
| `nuxt.config.ts` | Nuxt configuration — extends `@commonpub/layer`, declares `runtimeConfig.public.features`, wires SSR + modules |
| `commonpub.config.ts` | Instance config — feature flags, content types, auth methods, branding. Consumed via `useConfig()` everywhere |
| `server/` | Instance-specific server routes (most live in `@commonpub/layer/server/`) |
| `components/` | Optional instance overrides — shadow `@commonpub/layer/components/` filenames to swap implementations (used heavily by heatsynclabs.io for branding tweaks) |
| `scripts/seed.ts` | Dev seed script (`pnpm seed`) |
| `drizzle.config.js` | Migration runner config (talks to `DATABASE_URL`) |
| `__tests__/` + `e2e/` | App-level integration + Playwright e2e tests |

Routes, pages, composables, blocks, sections, admin chrome — all of those come from `@commonpub/layer`. This package is intentionally minimal.

## Develop

```bash
# Install once (monorepo)
pnpm install

# Local infra (Postgres + Redis at non-default ports per docker-compose.yml)
docker compose up -d

# Run migrations (root-level script — applies committed .sql files via drizzle-orm's migrate(), NOT drizzle-kit push)
node scripts/db-migrate.mjs

# Seed dev data
pnpm --filter @commonpub/reference seed

# Dev server (http://localhost:3000)
pnpm --filter @commonpub/reference dev

# Build for production
pnpm --filter @commonpub/reference build

# Preview the production build
pnpm --filter @commonpub/reference preview
```

## Test

```bash
pnpm --filter @commonpub/reference test         # vitest unit + integration
pnpm --filter @commonpub/reference typecheck    # nuxt typecheck (vue-tsc strict)
pnpm --filter @commonpub/reference e2e          # Playwright (separate task)
```

Repo-wide `pnpm test` + `pnpm typecheck` run these as part of the Turborepo graph.

## Environment variables

Names match what the codebase actually reads (`process.env.*`); `NUXT_*`-prefixed names override the matching `runtimeConfig` key per Nuxt convention.

| Variable | Purpose |
|---|---|
| `NUXT_DATABASE_URL` (or `DATABASE_URL` fallback) | Postgres connection — required. Read in `scripts/db-migrate.mjs` and `packages/schema/drizzle.config.ts`. |
| `NUXT_REDIS_URL` | Redis/Valkey connection — opt-in (memory fallback for realtime + queues when unset). |
| `NUXT_AUTH_SECRET` | Better Auth signing secret — required in production (refuses to start with the dev-fallback string). |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_PUBLIC_URL` / `S3_FORCE_PATH_STYLE` | Object storage (MinIO in dev, S3/R2 in prod). |
| `MEILI_URL` / `MEILI_MASTER_KEY` | Search backend (optional — falls back to Postgres FTS when unset). |
| `CPUB_FED_TOKEN_KEY` | Federation OAuth-token encryption key (64 hex chars = 32 bytes; off-by-one rejected). REQUIRED before flipping any `federation*` flag in production. |
| `NUXT_PUBLIC_FEATURES_*` | Per-feature override at runtime — each flag must ALSO be declared in `runtimeConfig.public.features` in `nuxt.config.ts` or the override silently drops (`feedback-nuxt-env-only-declared-keys`). |
| `ADMIN_BOOTSTRAP_FIRST_USER` | Opt-in: the first user to register becomes admin (one-click DO deploy template). |

## Deploy

The reference app deploys to commonpub.io via `.github/workflows/deploy.yml` (runs `node scripts/db-migrate.mjs` inside the container before swapping). Heatsynclabs and Deveco use the same Dockerfile/Nuxt build with their own `commonpub.config.ts` shadow. NEVER trust `gh run list` for deploy health — the workflow's curl-then-warn pattern means a crashed container shows as `success` with only a yellow annotation. Always `curl /api/health` afterwards (see `feedback-deploy-health-check-warn-not-fail`).

## Customisation pattern

For a new instance:

1. `cargo install create-commonpub` then `create-commonpub new my-instance` (Rust scaffolder on crates.io; pulls a known-good template)
2. Replace `commonpub.config.ts` with your instance's settings
3. Optional: shadow components by creating files in `components/` that match the path of a `@commonpub/layer` component (e.g., `components/HeroSection.vue` shadows the layer's `HeroSection`)
4. Optional: extend feature flags by adding to `nuxt.config.ts`'s `runtimeConfig.public.features` AND to your config

This package is intentionally not republished as your own — you depend on `@commonpub/layer` and adjust here.

## Related

- `@commonpub/layer` — the bulk of the app (routes, pages, composables, server utilities). Lives at `layers/base/`.
- `@commonpub/server` — framework-agnostic business logic (Drizzle queries, content services, identity).
- `@commonpub/config` — `defineCommonPubConfig()` factory + feature-flag types.
- `@commonpub/schema` — Drizzle tables, Zod validators, section configSchemas (added session 161), OpenAPI generator.
- `docs/plans/` — active planning docs (start with `layout-and-pages.md` + `phase-3-editor.md` if you're touching the layout editor).
