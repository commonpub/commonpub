# Session 011: CLI & Deployment

**Date**: 2026-03-10
**Phase**: 11 — CLI + Deployment (Weeks 29-31)

## What Was Done

### Pre-Implementation

- Created `docs/research/cli-deployment.md` — prior art on CLI scaffolding, Docker builds, DO/VPS deploy, CI/CD
- Created `docs/adr/022-cli-deployment-architecture.md` — architectural decisions for CLI, Docker, deploy, CI/CD, E2E

### Step 1: Dockerfile + Production Docker Compose

- Created `Dockerfile` (multi-stage: deps → build → runtime, node:22-alpine)
- Created `.dockerignore`
- Created `deploy/docker-compose.prod.yml` (app + postgres + redis + meilisearch, health checks, named network)
- Created `deploy/.env.prod.example` with all production env vars
- Created `deploy/package.json` for deploy tests (@commonpub/deploy workspace)
- 4 tests in `deploy/__tests__/docker.test.ts`

### Step 2: DigitalOcean App Platform Spec

- Created `deploy/app-spec.yaml` with managed Postgres + Redis

### Step 3: Droplet Setup Script

- Created `deploy/droplet-setup.sh` (Docker, Certbot, Nginx, systemd service, UFW)
- Created `deploy/nginx.conf` (reverse proxy, SSL, WebSocket upgrade, security headers)
- 2 tests in `deploy/__tests__/scripts.test.ts`

### Step 4: CI/CD Enhancement

- Modified `.github/workflows/ci.yml` — added `pnpm build` step after tests
- Created `.github/workflows/docker.yml` — build + push to ghcr.io on main/tags
- Created `.github/workflows/deploy.yml` — deploy on release (SSH or DO App Platform)
- 3 tests in `deploy/__tests__/ci.test.ts`

### Step 5: `create-commonpub` Rust CLI

- Created `tools/create-commonpub/` — full Rust CLI with clap, dialoguer, templates
- Subcommands: `new <name>` and `init`, with `--defaults` flag
- Template rendering: .env, commonpub.config.ts, package.json, docker-compose.yml
- Interactive prompts: name, domain, description, theme, Docker, feature flags
- 11 unit tests in template.rs, 6 integration tests in tests/cli.rs
- Release binary compiles and generates valid scaffold

### Step 6: E2E Tests

- Created `apps/reference/e2e/fixtures/setup.ts` (test users, signUp/signIn/signOut helpers)
- Created `apps/reference/e2e/fixtures/cleanup.ts`
- Created 4 E2E spec files: auth, content, theme, admin (12 tests total)
- Playwright config already existed and pointed to correct directory

### Step 7: Environment & Docs Cleanup

- Updated `.env.example` — added FEATURE_ADMIN, FEATURE_FEDERATION, FEATURE_EXPLAINERS; reorganized with section comments
- Created `docs/deployment.md` — quick start, Docker Compose, DO, VPS, env vars reference, SSL, backup, upgrade

## Test Counts

| Category               | Tests                            |
| ---------------------- | -------------------------------- |
| Deploy unit tests      | 9 (docker: 4, scripts: 2, ci: 3) |
| Rust unit tests        | 11                               |
| Rust integration tests | 6                                |
| E2E tests (Playwright) | 12                               |
| **Phase 11 total**     | **38**                           |
| **Running unit total** | **~878** (869 + 9 deploy)        |

## Decisions Made

- Rust CLI uses `_at` variants for path-safe scaffolding (avoids set_current_dir in tests)
- Deploy workspace added to pnpm-workspace.yaml
- Docker Compose prod uses `commonpub-net` network for service isolation
- CI/CD deploy supports both SSH (droplet) and doctl (App Platform) via `vars.DEPLOY_METHOD`
- E2E tests use defensive assertions (graceful skips when features disabled)

## Verification

- [x] `pnpm test` — 25 turbo tasks, all green
- [x] `cargo test` — 17 Rust tests pass
- [x] `cargo build --release` — CLI binary compiles
- [x] `./create-commonpub new test-instance --defaults` — generates valid scaffold
- [x] `docker compose -f deploy/docker-compose.prod.yml config` — valid
- [x] `.env.example` includes all feature flags

## Files Created/Modified

### Created (19 files)

- `Dockerfile`
- `.dockerignore`
- `deploy/docker-compose.prod.yml`
- `deploy/.env.prod.example`
- `deploy/package.json`
- `deploy/__tests__/docker.test.ts`
- `deploy/__tests__/scripts.test.ts`
- `deploy/__tests__/ci.test.ts`
- `deploy/app-spec.yaml`
- `deploy/droplet-setup.sh`
- `deploy/nginx.conf`
- `.github/workflows/docker.yml`
- `.github/workflows/deploy.yml`
- `tools/create-commonpub/Cargo.toml` + `src/{main,lib,prompts,scaffold,template}.rs` + `tests/cli.rs`
- `apps/reference/e2e/{auth,content,theme,admin}.spec.ts`
- `apps/reference/e2e/fixtures/{setup,cleanup}.ts`
- `docs/deployment.md`
- `docs/research/cli-deployment.md`
- `docs/adr/022-cli-deployment-architecture.md`

### Modified (3 files)

- `.github/workflows/ci.yml` — added build step
- `.env.example` — added missing feature flags, reorganized
- `pnpm-workspace.yaml` — added deploy workspace

## Post-Audit Fixes

- **Dockerfile**: added 4th stage (prod-deps) with `pnpm prune --prod` to exclude devDependencies from runtime image
- **docker-compose.prod.yml**: added app health check, meilisearch to depends_on, all feature flag env vars
- **deploy/.env.prod.example**: added MEILI_URL docs, fixed AUTH_SECRET generation instructions
- **droplet-setup.sh**: added root/OS preflight checks, fixed systemd Type (oneshot → forking)
- **nginx.conf**: added proxy timeouts (connect/send/read 60s)
- **Rust CLI prompts.rs**: replaced 13 `.unwrap()` with `?` error propagation, added `sanitize_value()` for input injection prevention
- **Rust CLI Cargo.toml**: removed unused `include_dir` dependency
- **ADR 022**: fixed user name (sveltekit → commonpub), updated to 4-stage Dockerfile, removed include_dir reference
- **deploy tests**: added test for app health check and meilisearch depends_on (now 10 tests)

## Open Questions

- Docker image not pushed (no ghcr.io credentials configured yet)
- E2E tests require running app + seeded DB — not wired into CI yet
- Meilisearch not included in DO App Platform spec (no managed offering)

## Next Steps

- Phase 12: Polish & Launch (docs site, landing page, final audit)
