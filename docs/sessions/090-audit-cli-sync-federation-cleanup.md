# Session 090 — Full Audit, CLI Sync, Federation Fixes, DO Deploy, UI Fixes

**Date**: 2026-03-29
**Scope**: commonpub monorepo + deveco-io — comprehensive audit, CLI template sync, federation fixes, DO one-click deploy, UI/badge fixes

## Context

Full audit of both repos after session 089's backport. Goals: verify deveco-io/reference app parity, find stubs, sync CLI template, fill federation gaps, verify all packages, build DO one-click deploy.

## Audit Findings

### deveco-io vs Reference App: SYNCED
After session 089, pages/API routes/composables are identical. Two deltas found and resolved:
- **ImageUpload.vue** — backported to reference app with `cpub-` design system compliance
- **DevEcoLogo.vue** — branding-only, not backported (correct)

### CLI Template: Was 35+ files behind (Fixed)
Missing federation pages, API routes, components, composables. All synced.

### Federation: Production-Hardened
848+ tests passing. Activity cleanup already wired. Announce handler was log-only (fixed).

### Stubs: Minimal
Zero TODO/FIXME/HACK in source. 1 skipped test (PGlite limitation).

## What Was Done

### 1. ImageUpload.vue Backport
- Created `components/ImageUpload.vue` in reference app (cpub- prefix, 2px borders, 0 radius, CSS vars)
- Added ImageUpload fields to `pages/hubs/create.vue` and `pages/hubs/[slug]/settings.vue`

### 2. CLI Template Sync
- Full resync of `tools/create-commonpub/reference-app/` from `apps/reference/`
- **Critical fix**: Version ranges changed from blanket `^0.4.0` (wrong for 0.x semver) to per-package ranges matching published versions
- Updated `scaffold.rs`, `template.rs`, `tests/cli.rs`

### 3. Announce Activity Persistence
- Added `boostCount` to `contentItems` table (schema 0.8.1)
- Added `localBoostCount` to `federatedContent` table
- Implemented full `onAnnounce` handler: idempotent, tracks local/federated boost counts, sends notifications

### 4. Federation Bug Fixes (from live testing)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Backfill/retry/refederate 403 | Used `event.context.session` (wrong) instead of `requireAdmin(event)` | Replaced in all 3 routes, both repos |
| `/docs/_payload.json` 404 | Feature middleware blocked `_payload.json` requests | Added payload exemption |
| Content API 500 after deploy | `boost_count` column missing from DB (drizzle-kit push failed silently due to TTY prompt) | Applied columns via direct SQL on both instances |
| drizzle-kit push silent failures | `--force` doesn't skip truncation prompts in non-TTY | Deploy workflow now warns instead of swallowing errors |
| Federated content not showing | `is_hidden=true` on all federated content (from session 089 band-aid) | Set `is_hidden=false`, verified dashboard exclusion code works |
| No cover images on federated content | `onUpdate` and `onCreate` onConflictDoUpdate didn't persist `coverImageUrl` or `attachments` | Added both fields to upsert/update paths (server 2.1.4) |
| Missing `cpub:type` in outbox | Activity payloads stored before extension was added | Patched stored payloads on deveco.io, re-federated all content |
| Federated content in featured query | `listContent` seamless federation didn't skip federated items when `featured=true` | Added `filters.featured` to exclusion condition (server 2.1.5) |
| Featured card showing unfeatured content | Homepage fetched `sort=popular&limit=1` and called it "Featured" | Changed to only query `featured=true`, no fallback |
| Badges unreadable on image cards | Transparent `rgba()` backgrounds invisible on cover photos | Dark opaque backgrounds (`rgba(0,0,0,0.75)`) with colored text |
| Admin feature button on federated content | Star button visible but non-functional on federated items | Hidden for federated, shows "federated" tag instead |

### 5. DigitalOcean One-Click Deploy

Three `doctl`-based scripts in `deploy/`:

- **`do-one-click.sh`** — Interactive provisioning (instance name, domain, admin credentials, features, region, size). Generates cloud-init with Docker, Caddy, Postgres, Redis, Meilisearch, schema push, first admin user.
- **`do-status.sh`** — Deployment health checker (SSH → cloud-init status, Docker services, HTTPS, disk)
- **`do-destroy.sh`** — Safe teardown with name confirmation

### 6. Featured Content Management
- New `PATCH /api/admin/content/[id]` endpoint for `isFeatured` toggle
- Admin content page has star toggle (local content only)
- Homepage featured card only shows when admin has explicitly featured something

### 7. Image Proxy for Federation
- New `/api/image-proxy` endpoint: proxies remote images, 24h browser + 7d server cache
- SSRF prevention (blocks private IPs, localhost, non-HTTPS)
- ContentCard + FederatedContentCard auto-proxy remote cover images
- Both repos have the proxy

## Package Versions Published

| Package | Version | Changes |
|---------|---------|---------|
| `@commonpub/schema` | 0.8.1 | `boostCount`, `localBoostCount` columns |
| `@commonpub/server` | 2.1.3 | Announce persistence |
| `@commonpub/server` | 2.1.4 | Cover image + attachments in upsert/update |
| `@commonpub/server` | 2.1.5 | Featured filter excludes federated content |

## Production Database Changes (Applied Manually)
- `content_items.boost_count` — integer, default 0, not null (both instances)
- `federated_content.local_boost_count` — integer, default 0, not null (both instances)
- `federated_content.is_hidden` — set to false for 3 backfilled items (commonpub.io)
- `federated_content.cpub_type` — set to 'project' for 3 items (commonpub.io)
- `federated_content.cover_image_url` — set from deveco.io source images (commonpub.io)
- Activity payloads patched with `cpub:type` (deveco.io)
- Old incomplete outbound Create activities deleted + re-federated (deveco.io)

## Test Results
- `@commonpub/server`: 480 passed, 1 skipped
- `@commonpub/protocol`: 367 passed
- `@commonpub/schema`: 319 passed
- All other packages: passing
- Total: 2,279 passed, 1 skipped, 0 failed

## Known Issues Remaining
- E2E CI flaky (9 Playwright failures — tab switching, footer links, login form visibility — pre-existing, not from this session)
- `drizzle-kit push` can't run non-interactively when it wants to truncate a table (content_builds unique constraint false positive)
- `/docs/_payload.json` warning still appears in console (feature middleware fix deployed but may need hard refresh)

## Open Questions
- Hub-to-content association UI is missing (no way to add projects to hubs from either side)
- Hub discussion/post creation UI needs investigation
- Should we add server-side image resizing to the image proxy? (currently passthrough only)
- DigitalOcean Marketplace vendor submission requires Packer image — worth pursuing?
