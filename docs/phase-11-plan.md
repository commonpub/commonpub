# Phase 11: CLI + Deployment

## Context

Phases 0–10 are complete (869 tests, all builds green). Phase 11 delivers the master plan goal: "CLI + Deployment (Weeks 29-31)."

**What exists:**

- `deploy/docker-compose.yml` — dev env (Postgres, Redis, Meilisearch)
- `deploy/docker-compose.federation.yml` — multi-instance federation dev setup
- `deploy/federation-seed.ts` — test data seed script
- `.github/workflows/ci.yml` — basic CI (typecheck, lint, test) — no build, no deploy
- `playwright.config.ts` — configured for `apps/reference/e2e/` — no tests exist
- `apps/reference/svelte.config.js` — adapter-node configured
- `tools/worker/` — AP delivery monitoring utilities (complete)
- `tools/create-commonpub/` — **empty directory** (deferred from earlier phases)
- `.env.example` — env var template

**What's missing:**

- No `Dockerfile` — can't containerize the reference app
- No `docker-compose.prod.yml` — no production orchestration
- No `app-spec.yaml` — no DigitalOcean App Platform spec
- No `droplet-setup.sh` — no server provisioning script
- No E2E tests — Playwright configured but `apps/reference/e2e/` is empty
- No `create-commonpub` CLI — Rust CLI not started
- CI/CD has no build step, no Docker image push, no deploy trigger
- `.env.example` missing `FEATURE_ADMIN` flag added in Phase 10

---

## Pre-Implementation

### 0A. Research Document

Create `docs/research/cli-deployment.md` — Prior art from `create-svelte`, `create-next-app`, `create-t3-app` CLI patterns; Docker multi-stage Node builds; DO App Platform vs droplet deployment; GitHub Actions deploy workflows.

### 0B. ADR 022: CLI & Deployment Architecture

Create `docs/adr/022-cli-deployment-architecture.md` covering:

1. **CLI**: Rust binary via `clap` — interactive prompts, template from reference app, generates `commonpub.config.ts` + `.env` + Docker files
2. **Docker**: Multi-stage Node build — install → build → runtime (node:22-alpine); single `Dockerfile` at repo root
3. **Production compose**: App + Postgres + Redis + Meilisearch; optional Plausible sidecar
4. **DO App Platform**: `app-spec.yaml` for managed deployment (app + managed DB + Redis)
5. **Droplet deploy**: Shell script for VPS provisioning (Docker, Certbot, systemd)
6. **CI/CD**: Add build + Docker push + deploy-on-tag steps
7. **E2E tests**: Critical user journeys only — auth, content CRUD, theme switching

---

## Implementation Steps (TDD Order)

### Step 1: Dockerfile + Production Docker Compose (~4 tests)

**Create** `Dockerfile` (repo root):

- Stage 1 `deps`: `node:22-alpine`, install pnpm, `pnpm install --frozen-lockfile`
- Stage 2 `build`: copy deps, `pnpm build` (all packages + app)
- Stage 3 `runtime`: `node:22-alpine`, copy built `apps/reference/build/`, `node_modules` (prod only), expose 3000
- Env vars: `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `ORIGIN`, `PORT=3000`
- `.dockerignore`: node_modules, .git, .svelte-kit, dist, \*.test.ts, docs/, deploy/

**Create** `deploy/docker-compose.prod.yml`:

- `app` service: builds from `Dockerfile`, depends on postgres + redis
- `postgres`: postgres:16-alpine with named volume, health check
- `redis`: redis:7-alpine with named volume, health check
- `meilisearch`: getmeili/meilisearch:v1.12 with API key
- Network: `commonpub-net` (internal)
- Optional `plausible` service (commented out)

**Create** `deploy/.env.prod.example`:

- All production env vars with secure defaults guidance

**Tests** `deploy/__tests__/docker.test.ts`:

- Dockerfile exists and has multi-stage structure (grep for `FROM.*AS`)
- docker-compose.prod.yml parses as valid YAML
- All required services present (app, postgres, redis)
- Health checks defined on all services

### Step 2: DigitalOcean App Platform Spec

**Create** `deploy/app-spec.yaml`:

- App component: Dockerfile build, env vars from app-level env, HTTP port 3000
- Database component: PostgreSQL 16 (managed, `db-s-1vcpu-1gb`)
- Redis component: (managed, `db-s-1vcpu-1gb`)
- Domain configuration placeholder
- Health check route: `/` (200 OK)
- Build command + run command

### Step 3: Droplet Setup Script (~2 tests)

**Create** `deploy/droplet-setup.sh`:

- Install Docker + Docker Compose
- Install Certbot for Let's Encrypt SSL
- Create `commonpub` system user
- Clone repo, copy env template
- Set up systemd service for `docker compose up`
- Configure Nginx reverse proxy with SSL
- UFW firewall rules (80, 443, 22)

**Create** `deploy/nginx.conf`:

- Reverse proxy to `localhost:3000`
- SSL termination (Certbot certs)
- WebSocket upgrade for SvelteKit HMR (dev) / federation (prod)
- Security headers (HSTS, X-Frame-Options, CSP)

**Tests** `deploy/__tests__/scripts.test.ts`:

- droplet-setup.sh exists and is executable
- nginx.conf has required proxy_pass directive
- nginx.conf has SSL configuration blocks

### Step 4: CI/CD Enhancement (~3 tests)

**Modify** `.github/workflows/ci.yml`:

- Add `build` step after tests: `pnpm build`
- Add build artifact caching

**Create** `.github/workflows/docker.yml`:

- Trigger: push to `main`, tags `v*`
- Build Docker image
- Push to GitHub Container Registry (`ghcr.io`)
- Tag with git SHA + `latest` (main) or semver (tags)

**Create** `.github/workflows/deploy.yml`:

- Trigger: release published (tag `v*`)
- Deploy to DO App Platform via `doctl` CLI
- Or SSH deploy to droplet (configurable)

**Tests** `deploy/__tests__/ci.test.ts`:

- ci.yml has build step
- docker.yml exists with correct triggers
- deploy.yml exists with release trigger

### Step 5: `create-commonpub` Rust CLI (~18 tests)

**Create** `tools/create-commonpub/Cargo.toml`:

- Dependencies: `clap` (CLI args), `dialoguer` (interactive prompts), `console` (colors), `indicatif` (progress bars), `toml` (config gen), `include_dir` (template embedding)

**Create** `tools/create-commonpub/src/main.rs`:

- Subcommands: `new`, `init`
- `new <name>`: Create new project directory with full scaffold
- `init`: Initialize in current directory

**Create** `tools/create-commonpub/src/scaffold.rs`:

- Copy template files from embedded reference app
- Generate `commonpub.config.ts` from user answers
- Generate `.env` from user answers
- Generate `docker-compose.yml` (customized)
- Set up `package.json` with project name

**Create** `tools/create-commonpub/src/prompts.rs`:

- Instance name (required)
- Instance domain (required)
- Instance description (optional)
- Database URL (default: local Docker)
- Feature flags: content, social, communities, docs, learning, federation, admin (checkboxes)
- Auth providers: email/password (default), GitHub OAuth, Google OAuth
- Theme: base, deepwood, hackbuild, deveco (select)

**Create** `tools/create-commonpub/src/template.rs`:

- Template file processing (variable substitution)
- File tree generation from embedded assets

**Create** `tools/create-commonpub/templates/`:

- Stripped-down reference app template files
- `commonpub.config.ts.tmpl` — config template with placeholders
- `.env.tmpl` — env template with placeholders
- `docker-compose.yml.tmpl` — compose template
- `package.json.tmpl` — package.json with project name

**Tests** `tools/create-commonpub/tests/`:

- `scaffold.rs`: Template variable substitution works
- `prompts.rs`: Default values are correct
- `template.rs`: File tree generation produces expected structure
- Config generation produces valid TypeScript
- Env generation includes all required variables
- Feature flag selection maps correctly to config
- CLI parses `new` and `init` subcommands
- Generated project has correct directory structure

### Step 6: E2E Tests — Critical Paths (~12 tests)

**Create** `apps/reference/e2e/`:

| Test File         | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `auth.spec.ts`    | Sign up, sign in, sign out flow                      |
| `content.spec.ts` | Create, view, edit, archive content                  |
| `theme.spec.ts`   | Theme picker preview, apply, persistence             |
| `admin.spec.ts`   | Admin dashboard access (staff role), 403 for members |

**Prerequisites** (test fixtures):

- `apps/reference/e2e/fixtures/setup.ts` — DB seed with test users (member, staff, admin)
- `apps/reference/e2e/fixtures/cleanup.ts` — Teardown after tests

**Playwright global setup**:

- Start dev server
- Run database migrations
- Seed test data

### Step 7: Environment & Documentation Cleanup

**Modify** `.env.example`:

- Add `FEATURE_ADMIN=false` (missing from Phase 10)
- Add `FEATURE_FEDERATION=false`
- Add `FEATURE_EXPLAINERS=true`
- Add `FEATURE_LEARNING=true`
- Reorganize with section comments

**Create** `docs/deployment.md`:

- Quick start (Docker Compose)
- Production (Docker Compose prod)
- DigitalOcean App Platform
- VPS/Droplet deployment
- Environment variables reference
- SSL/TLS setup
- Backup strategy

---

## Dependency Graph

```
Step 1 (Docker) ──┬──> Step 2 (DO spec)
                  ├──> Step 3 (Droplet)
                  └──> Step 4 (CI/CD)

Step 5 (Rust CLI) ──> (independent, parallelize with 1-4)

Step 6 (E2E tests) ──> (independent, parallelize with 1-5)

Step 7 (Docs/env) ──> (after all steps, cleanup)
```

Steps 1-6 can all parallelize. Step 7 is final cleanup.

---

## Critical Files

| File                                    | Action | Purpose                   |
| --------------------------------------- | ------ | ------------------------- |
| `Dockerfile`                            | Create | Multi-stage Node.js build |
| `.dockerignore`                         | Create | Exclude non-build files   |
| `deploy/docker-compose.prod.yml`        | Create | Production orchestration  |
| `deploy/.env.prod.example`              | Create | Production env template   |
| `deploy/app-spec.yaml`                  | Create | DO App Platform spec      |
| `deploy/droplet-setup.sh`               | Create | VPS provisioning          |
| `deploy/nginx.conf`                     | Create | Reverse proxy + SSL       |
| `.github/workflows/ci.yml`              | Modify | Add build step            |
| `.github/workflows/docker.yml`          | Create | Docker image build + push |
| `.github/workflows/deploy.yml`          | Create | Release deployment        |
| `tools/create-commonpub/Cargo.toml`      | Create | Rust CLI project          |
| `tools/create-commonpub/src/main.rs`     | Create | CLI entry point           |
| `tools/create-commonpub/src/scaffold.rs` | Create | Project scaffolding       |
| `tools/create-commonpub/src/prompts.rs`  | Create | Interactive prompts       |
| `tools/create-commonpub/src/template.rs` | Create | Template processing       |
| `tools/create-commonpub/templates/`      | Create | Scaffold templates        |
| `apps/reference/e2e/*.spec.ts`          | Create | E2E test suites           |
| `.env.example`                          | Modify | Add missing feature flags |
| `docs/deployment.md`                    | Create | Deployment guide          |

---

## Test Counts

| Step                     | Area               | Tests         |
| ------------------------ | ------------------ | ------------- |
| 1                        | Docker validation  | 4             |
| 2                        | DO spec            | 0 (YAML only) |
| 3                        | Scripts validation | 2             |
| 4                        | CI validation      | 3             |
| 5                        | Rust CLI           | 18            |
| 6                        | E2E (Playwright)   | 12            |
| 7                        | Env/docs cleanup   | 0             |
| **Phase 11 new**         |                    | **~39**       |
| **Running total (unit)** |                    | **~908**      |
| **E2E total**            |                    | **~12**       |

Note: Rust tests run via `cargo test`, separate from `pnpm test`. E2E tests run via `pnpm test:e2e`, also separate.

---

## What's Deferred

| Feature                              | Defer To | Reason                           |
| ------------------------------------ | -------- | -------------------------------- |
| Helm charts for Kubernetes           | Post v1  | Docker Compose sufficient for v1 |
| CLI `upgrade` command                | Post v1  | Manual upgrades for now          |
| CLI plugin system                    | Post v1  | Core scaffold sufficient         |
| Automated database migrations in CLI | Phase 12 | Manual Drizzle push for now      |
| Multi-arch Docker builds (ARM)       | Post v1  | x86_64 sufficient for v1         |
| GitHub Actions matrix testing        | Phase 12 | Single-platform CI sufficient    |

---

## Verification

1. `pnpm build` — all packages compile
2. `pnpm test` — ~908 unit tests green
3. `docker build -t commonpub .` — image builds successfully
4. `docker compose -f deploy/docker-compose.prod.yml up` — all services healthy
5. `cargo test` in `tools/create-commonpub/` — 18 Rust tests green
6. `cargo build --release` in `tools/create-commonpub/` — binary compiles
7. `./create-commonpub new test-instance` — generates valid project scaffold
8. Generated project: `pnpm install && pnpm build` passes
9. `pnpm test:e2e` — 12 Playwright tests pass (auth, content, theme, admin)
10. CI workflow includes build step
11. Docker workflow builds and pushes image
12. `.env.example` includes all feature flags from Phases 1-10
13. `docs/deployment.md` covers Docker, DO, VPS paths
14. Session log at `docs/sessions/011-cli-deployment.md`
