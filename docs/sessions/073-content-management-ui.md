# Session 073 — Content Management UI, Auth Fix, Edge AI Removal, Production Deploy

**Date:** 2026-03-25
**Scope:** Dashboard delete/unpublish UI, auth origin fix, edge AI removal, Discord link, production deploy to DigitalOcean
**Status:** Complete — site live at https://commonpub.io

## Changes

### 1. Dashboard Content Actions (commonpub + deveco-io)

Added unpublish and delete buttons to the user dashboard in both repos.

**Files changed:**
- `apps/reference/pages/dashboard.vue` (commonpub)
- `pages/dashboard.vue` (deveco-io)

**What was added:**
- **Unpublish button** (eye-slash icon) on published content rows — sets status to `draft` via `PUT /api/content/[id]`
- **Delete button** (trash icon) on both draft and published rows — soft deletes via `DELETE /api/content/[id]`
- Confirmation dialogs before both actions
- Loading spinner per-item while action is in progress
- Toast feedback on success/failure
- `refreshNuxtData()` to re-fetch dashboard data after mutations

**Backend already existed** — no server changes needed:
- `deleteContent()` in `@commonpub/server` → sets `status='archived'`, `deletedAt=now()`
- `updateContent()` with `{ status: 'draft' }` → unpublishes
- Both enforce ownership (authorId match)

### 2. Auth "Invalid Origin" Fix

**Root cause:** Better Auth validates request origin against `baseURL`. When Nuxt picks a different port (3000 occupied → 3003), auth requests are rejected.

**Fix:**
- Added `trustedOrigins` parameter to `@commonpub/auth` (`createAuth.ts`, `types.ts`)
- Server middleware passes localhost ports 3000-3005 as trusted in dev mode
- Production uses only the configured `siteUrl`

**Files changed:**
- `packages/auth/src/createAuth.ts`
- `packages/auth/src/types.ts`
- `apps/reference/server/middleware/auth.ts`

### 3. Remove Edge AI References

Replaced all edge AI / TinyML / hardware-specific content in the reference app with generic maker community content.

**Files changed:**
- `pages/index.vue` — SEO meta
- `pages/learn/index.vue` — hero title
- `pages/videos/index.vue` — hero subtitle
- `pages/search.vue` — tag suggestions, categories
- `pages/contests/create.vue` — placeholder
- `pages/products/index.vue` — description
- `scripts/seed.ts` — all user bios, content, hubs, tags, videos, contests, learning paths
- `e2e/seo.spec.ts` — meta assertion
- `__tests__/contest-slug.test.ts` — test case

### 4. Discord Link

Updated footer Discord link from placeholder `discord.gg/commonpub` to `discord.gg/uncPaJ5SwV`.

**File:** `apps/reference/layouts/default.vue`

### 5. Production Deploy to DigitalOcean

Deployed commonpub.io to a DigitalOcean droplet with full CI/CD pipeline.

**Infrastructure created:**
- **Droplet:** `commonpub-prod` — s-2vcpu-2gb, nyc1, `161.35.6.228`
- **Block storage:** `commonpub-data` — 10GB ext4 volume mounted at `/mnt/commonpub_data`
- **DNS:** A records for `commonpub.io` and `www.commonpub.io` → droplet IP
- **CAA record:** `letsencrypt.org` for auto cert issuance
- **Firewall:** `commonpub-fw` — SSH, HTTP, HTTPS only
- **SSH key:** `commonpub-deploy` (ed25519) for GitHub Actions → droplet
- **DO project:** Resources assigned to existing `commonpub` project

**Services running (all healthy):**
- **Caddy** — auto-TLS (Let's Encrypt), HTTP/2 + HTTP/3, security headers, SSE streaming
- **CommonPub app** — Nuxt SSR via Docker
- **PostgreSQL 16** — data on block storage
- **Redis 7** — 256MB max, LRU eviction, data on block storage
- **Meilisearch v1.12** — production mode, data on block storage

**Deploy pipeline (GitHub Actions):**
1. Push to `main` triggers `.github/workflows/deploy.yml`
2. Build Docker image on ubuntu runner (linux/amd64)
3. Save as gzipped tarball
4. SCP to droplet `/opt/commonpub/`
5. SSH: load image, `docker compose up -d --force-recreate`, prune old images

**Files changed:**
- `deploy/docker-compose.prod.yml` — rewritten: Caddy, block storage mounts, env_file
- `deploy/Caddyfile` — new: auto-TLS, security headers, SSE, www redirect
- `deploy/droplet-setup.sh` — rewritten: block storage mount, simplified for Docker image
- `.github/workflows/deploy.yml` — rewritten: SCP+SSH deploy pattern (from deveco-io)

**GitHub secrets set:**
- `PROD_HOST` — droplet IP
- `PROD_SSH_KEY` — deploy SSH private key

**Production .env on droplet** (`/opt/commonpub/.env`):
- Database: local Postgres via Docker network
- Email: Resend adapter configured
- Features: content, social, hubs, docs, video, learning, explainers, admin enabled
- Federation and contests disabled for now

**Schema migration:** Ran `drizzle-kit push --force` via temporary Node container on droplet network. All tables created.

## Test Results

- Reference app: 47/47 passed
- Server package: 312/312 passed (1 skipped, pre-existing)
- Auth package: 42/42 passed
- Pre-existing failure: `@commonpub/docs` markdown rendering timeout (unrelated)

## Decisions

- **Soft delete only** — user delete sets `status='archived'` + `deletedAt`, no hard delete
- **Confirmation required** — both unpublish and delete require `confirm()` dialog
- **Per-item loading** — action buttons show spinner only for the item being acted on
- **trustedOrigins in dev** — hardcoded port range 3000-3005 rather than wildcard, keeps security meaningful
- **Caddy over nginx** — proven in deveco-io, simpler auto-TLS, HTTP/3 support
- **Block storage for all data** — Postgres, Redis, Meilisearch all on `/mnt/commonpub_data` (10GB DO volume)
- **SCP deploy over registry** — simpler, no container registry needed, proven in deveco-io

### 6. Package Publish — All 12 Packages to v0.5.0

Bumped all packages from 0.4.x to 0.5.0 and published to npm in dependency order.

**Publish order (by tier):**
1. config, schema, ui, infra (no internal deps)
2. protocol, editor, docs, test-utils
3. auth, explainer
4. learning
5. server

**Also updated:**
- `apps/reference` bumped to 0.5.0
- **deveco-io** bumped all `@commonpub/*` deps to `^0.5.0`, built, tested (46/46), pushed

**All tests green:** 1516 package tests + 47 reference + 46 deveco-io

## Open Questions

- Should there be an "undo" / "restore from archive" UI? Currently archived content is invisible to users.
- Should the content detail page (view mode) also show unpublish/delete for the author?
- When to enable federation and contests on commonpub.io?
- DO Spaces for uploads instead of local volume?
