# ADR 022: CLI & Deployment Architecture

**Status**: Accepted
**Date**: 2026-03-10

## Context

Phases 0–10 are complete (869 tests). The codebase has a working reference app, 10 packages, Docker Compose for local dev, and Turborepo CI. What's missing: a CLI to scaffold new instances, production Docker images, deployment pipelines, and E2E tests for critical user journeys.

## Decisions

### 1. CLI: Rust Binary via clap

Rust single binary — no Node runtime required for scaffolding. Uses `clap` (derive macro) for arg parsing, `dialoguer` for interactive prompts. Templates are rendered programmatically via format strings with input sanitization.

Prompts:

- Instance name
- Domain
- Database URL (or use bundled Postgres)
- Features to enable (docs, federation, admin, learning, communities)
- Theme (base, deepwood, hackbuild, deveco)

Output: project directory with `commonpub.config.ts`, `.env`, `docker-compose.yml`, and Nginx config. Supports `--yes` flag to accept all defaults.

**Why Rust**: Single binary distribution, no runtime deps, fast startup. Matches precedent of `create-turbo` (Go) and Biome (Rust) shipping as standalone binaries.

### 2. Docker: Multi-Stage Node Build

Four-stage Dockerfile targeting `node:22-alpine`:

```
Stage 1 (deps):      Install pnpm, copy lockfile, install all dependencies
Stage 2 (build):     Copy source, run turbo build
Stage 3 (prod-deps): Prune dev dependencies (pnpm prune --prod)
Stage 4 (runtime):   Copy build output + prod-only node_modules, non-root user
```

- Non-root `commonpub` user
- Health check on `/health` endpoint
- `ORIGIN`, `PORT`, `DATABASE_URL` as runtime env vars

**Why alpine**: ~50MB base vs ~350MB debian. Node.js runs fine on musl libc for server workloads.

### 3. Production Compose

`deploy/docker-compose.prod.yml` with four services:

| Service       | Image                              | Purpose                      |
| ------------- | ---------------------------------- | ---------------------------- |
| `app`         | `ghcr.io/commonpub/commonpub:latest` | SvelteKit app (adapter-node) |
| `postgres`    | `postgres:16-alpine`               | Primary database             |
| `redis`       | `redis:7-alpine`                   | Queue + session cache        |
| `meilisearch` | `getmeili/meilisearch:v1`          | Full-text search             |

All services have health checks. Postgres data on a named volume. App depends on healthy Postgres + Redis before starting.

### 4. DO App Platform: app-spec.yaml

Declarative deployment via `.do/app.yaml`. App Platform handles TLS, load balancing, and auto-deploy from GitHub.

```yaml
services:
  - name: app
    dockerfile_path: deploy/Dockerfile
    http_port: 3000
    instance_size_slug: professional-xs
databases:
  - name: db
    engine: PG
    version: '16'
```

Redis and Meilisearch run as worker components or external add-ons.

**Why offer App Platform**: Lowest-friction path for users who want managed infrastructure. No Nginx, no Certbot, no SSH.

### 5. Droplet Deploy: Shell Script + Nginx + Certbot

For self-hosters who want full control. CLI generates:

- `deploy.sh` — pulls images, runs migrations, restarts services, prunes old images
- `nginx.conf` — reverse proxy to `:3000`, WebSocket upgrade headers, rate limiting
- Certbot command for Let's Encrypt TLS

Deploy flow: SSH → run `deploy.sh`. Future: optional webhook endpoint for deploy-on-push.

**Why both paths**: App Platform for convenience, Droplet for control. Different users have different needs.

### 6. CI/CD: Build + Docker Push to ghcr.io + Deploy-on-Tag

GitHub Actions workflow triggered on version tags (`v*`):

1. **Test** — `turbo run test lint typecheck` (existing CI)
2. **Build** — Docker multi-stage build with GHA layer cache (`type=gha`)
3. **Push** — Push to `ghcr.io/commonpub/commonpub:{tag}` and `:latest`
4. **Deploy** — Optional: SSH to droplet and run `deploy.sh`, or trigger DO App Platform redeploy

Tag format: `v{major}.{minor}.{patch}` (semver). Only tagged commits produce Docker images.

**Why ghcr.io**: Free for public repos, integrated with GitHub permissions, no separate registry account needed.

### 7. E2E: Critical User Journeys Only

Playwright tests covering the critical paths — not exhaustive, just the flows that must never break:

| Journey | What it tests                                          |
| ------- | ------------------------------------------------------ |
| Auth    | Sign up → sign in → sign out                           |
| Content | Create → edit → publish → view                         |
| Theme   | Switch theme → verify CSS vars applied                 |
| Admin   | Access admin panel → change setting → verify audit log |
| Docs    | Create site → add page → search → verify render        |

E2E tests run against a Docker Compose stack (app + Postgres + Redis) in CI. Separate workflow from unit/integration tests to keep feedback fast.

**Why critical journeys only**: E2E tests are slow and brittle. Unit/integration tests (869 existing) cover edge cases. E2E validates the full stack works end-to-end.

## Consequences

- CLI ships as a single binary — users don't need Node.js to scaffold a project
- Docker image is reproducible and minimal (~150MB runtime)
- Two deployment paths cover both managed and self-hosted use cases
- CI/CD automates the full build-test-push-deploy pipeline
- E2E tests catch integration failures that unit tests miss
- Deploy-on-tag means no accidental deploys from feature branches
- ghcr.io keeps Docker images close to the source code
