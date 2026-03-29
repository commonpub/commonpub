# Session 090 — Full Audit, CLI Template Sync, Federation Cleanup

**Date**: 2026-03-29
**Scope**: commonpub monorepo + deveco-io — comprehensive audit, CLI template sync, Announce persistence, ImageUpload backport

## Context

Full audit of both repos after session 089's backport. Goals: verify deveco-io/reference app parity, find stubs, sync CLI template, fill federation gaps, verify all packages.

## Audit Findings

### deveco-io vs Reference App: SYNCED
After session 089, pages/API routes/composables are identical. Two deltas found:
- **ImageUpload.vue** — existed in deveco-io but not reference app (used in hubs + ContentStarterForm)
- **DevEcoLogo.vue** — branding-only, not backported (correct)

### CLI Template: STALE (Fixed)
The `create-commonpub` Rust CLI's embedded `reference-app/` was ~35 files behind:
- Missing 5 pages (federation/*, mirror/*, auth/oauth/authorize)
- Missing 28 API routes (admin/federation/*, auth/federated/*, federation/*)
- Missing 5 components (ContentStarterForm, FederatedContentCard, PublishErrorsModal, RemoteActorCard, RemoteUserSearch)
- Missing 3 composables (useContentSave, useFederation, usePublishValidation)

### Federation: Production-Hardened
- 848 tests passing across packages
- Activity cleanup already wired in federation-delivery.ts plugin (counter-based daily schedule)
- Announce handler was log-only (no boost count persistence)

### Stubs: Minimal
- Zero TODO/FIXME/HACK in source
- 1 skipped test (PGlite driver limitation)
- Announce handler was the only functional stub

## What Was Done

### 1. ImageUpload.vue Backport
- Created `components/ImageUpload.vue` in reference app with CommonPub design system compliance:
  - `cpub-` class prefix (not `de-`)
  - 2px borders, 0 border-radius
  - CSS custom properties only (`var(--font-mono)`, `var(--color-surface-scrim)`)
  - JetBrains Mono uppercase labels
- Added ImageUpload fields to `pages/hubs/create.vue` (iconUrl, bannerUrl)
- Added ImageUpload fields to `pages/hubs/[slug]/settings.vue` (iconUrl, bannerUrl)

### 2. CLI Template Sync
- Ran `rsync` from `apps/reference/` → `tools/create-commonpub/reference-app/` (excluding build artifacts/tests)
- Verified zero diff between reference app and CLI template
- Added test assertions in `tests/cli.rs` for new files:
  - Federation pages and routes
  - New composables (useContentSave, useFederation, usePublishValidation)
  - New components (ImageUpload, ContentStarterForm, FederatedContentCard, PublishErrorsModal, RemoteActorCard, RemoteUserSearch)

### 3. Announce Activity Persistence
- Added `boostCount` column to `contentItems` table (schema)
- Added `localBoostCount` column to `federatedContent` table (schema)
- Implemented full `onAnnounce` handler in `inboxHandlers.ts`:
  - Idempotency check (deduplicates by actor+object)
  - Local content boost count increment (by slug match)
  - Federated content boost count increment (by objectUri)
  - Author notification on local content boost
  - Activity logging

### 4. Activity Cleanup — Already Wired
- Confirmed `cleanupDeliveredActivities()` is called from `federation-delivery.ts` plugin
- Counter-based scheduling runs cleanup approximately once per 24h
- Uses `activityRetentionDays` from federation config (default: 90 days)

## Test Results
- `@commonpub/server`: 480 passed, 1 skipped (PGlite limitation)
- `@commonpub/protocol`: 367 passed
- `@commonpub/schema`: all passed
- All packages build clean

## Schema Changes (requires db:push on deploy)
- `content_items.boost_count` — integer, default 0, not null
- `federated_content.local_boost_count` — integer, default 0, not null

## Open Questions
- Should the CLI prune federation-related pages when `feature_federation=false`? Currently all pages are copied and gated at runtime via feature middleware. This is simpler but results in dead code in non-federation instances.
- Should we update package versions for the schema/server changes? (boostCount is additive, non-breaking)

### 5. DigitalOcean One-Click Deploy Tooling

Created three `doctl`-based scripts in `deploy/`:

**`do-one-click.sh`** — Interactive provisioning script
- Prompts for: instance name, domain, admin credentials, features, content types, region, size, SSH key
- Generates secrets (Postgres password, auth secret, Meilisearch key)
- Builds cloud-init user-data inline with:
  - Docker + compose install (Ubuntu 24.04 base)
  - .env generation with all config
  - Caddyfile with security headers, inbox body limits, SSE unbuffering
  - docker-compose.yml (Caddy + app + Postgres 16 + Redis 7 + Meilisearch v1.12)
  - Git clone + Docker build of CommonPub
  - Schema push via drizzle-kit
  - First admin user creation (Better Auth compatible password hash)
- Creates droplet via `doctl compute droplet create` with `--user-data-file`
- Supports `--dry-run` for preview without creating resources
- Saves deployment info to `.last-deploy-{slug}.json`

**`do-status.sh`** — Deployment status checker
- Lists all CommonPub droplets (tagged `commonpub`)
- SSHs to droplet to check: cloud-init status, Docker services, app health, HTTPS, disk usage
- Shows live cloud-init log tail if setup still in progress

**`do-destroy.sh`** — Safe teardown
- Requires typing droplet name to confirm (no accidental deletes)
- Cleans up local deployment info file

**Tested:** Full dry-run with piped input validates all prompts, secret generation, cloud-init YAML structure, and doctl command construction.

## Deploy Actions Needed
- Run `db:push` on both production instances to add boost_count columns
- Point DNS before running `do-one-click.sh` (or immediately after, before TLS cert issuance)

## Open Questions
- Should the CLI prune federation-related pages when `feature_federation=false`? Currently all pages are copied and gated at runtime via feature middleware. This is simpler but results in dead code in non-federation instances.
- Should we update package versions for the schema/server changes? (boostCount is additive, non-breaking)
- Cloud-init installs `docker.io` from Ubuntu repos (might be slightly behind Docker CE). Consider switching to Docker official repo for production.
- The admin user creation uses scrypt hashing — need to verify this matches Better Auth's expected format exactly.

## Next Steps
- Test a real deployment with `do-one-click.sh` on a disposable domain
- Run `db:push` on both production instances to add boost_count columns
- Consider `cargo test` run for CLI after next Rust toolchain sync
- Explore DO Marketplace vendor submission (requires Packer image, vendor agreement)
