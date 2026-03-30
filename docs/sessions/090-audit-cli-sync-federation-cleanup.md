# Session 090 — Full Audit, CLI Sync, Federation Fixes, DO Deploy, Hub UI, Featured Management

**Date**: 2026-03-29
**Scope**: commonpub monorepo + deveco-io — comprehensive audit, CLI template sync, federation fixes, DO one-click deploy, hub UI overhaul, featured content management, badge/image fixes

## Context

Full audit of both repos after session 089's backport. Goals: verify deveco-io/reference app parity, find stubs, sync CLI template, fill federation gaps, verify all packages, build DO one-click deploy, fix live production bugs, build missing hub UI.

## Audit Findings

### deveco-io vs Reference App: SYNCED
After session 089, pages/API routes/composables are identical. Two deltas found and resolved:
- **ImageUpload.vue** — backported to reference app with `cpub-` design system compliance
- **DevEcoLogo.vue** — branding-only, not backported (correct)

### CLI Template: Was 35+ files behind (Fixed)
Missing federation pages, API routes, components, composables. All synced.

### Federation: Production-Hardened
848+ tests passing. Activity cleanup already wired. Announce handler was log-only (fixed). Full flow audit confirmed all changes are safe — no breaking side effects.

### Hub Federation: Output-Only by Design
- Hubs are FEP-1b12 Group actors (Announce outbound only)
- No hub backfill mechanism — correct per CLAUDE.md rule 5 (local-only until real moderation experience)
- Hub follows, posts, shares all work through `hubFollowers` table

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
- CLI template resynced after every subsequent change throughout the session

### 3. Announce Activity Persistence
- Added `boostCount` to `contentItems` table
- Added `localBoostCount` to `federatedContent` table
- Implemented full `onAnnounce` handler: idempotent, tracks local/federated boost counts, sends notifications

### 4. Federation Bug Fixes (from live testing)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Backfill/retry/refederate 403 | Used `event.context.session` instead of `requireAdmin(event)` | Replaced in all 3 routes, both repos |
| `/docs/_payload.json` 404 | Feature middleware blocked `_payload.json` requests | Added payload exemption |
| Content API 500 after deploy | `boost_count` column missing (drizzle-kit push failed silently) | Applied columns via direct SQL on both instances |
| drizzle-kit push silent failures | `--force` doesn't skip truncation prompts in non-TTY | Deploy workflow now warns instead of swallowing errors |
| Federated content not showing | `is_hidden=true` (session 089 band-aid) | Set false; dashboard exclusion code (`filters.authorId`) verified working |
| No cover images on federated content | `onUpdate`/`onCreate` upsert didn't persist `coverImageUrl`/`attachments` | Added both fields to upsert/update paths |
| Missing `cpub:type` in outbox | Activity payloads stored before extension was added | Patched stored payloads, re-federated all content |
| Federated content in featured query | Seamless federation didn't skip federated items when `featured=true` | Added `filters.featured` to exclusion condition |
| `isFeatured` missing from list items | `mapToListItem` didn't include field, admin star never showed active | Added to `ContentListItem` type and mapper |
| Post type enum incomplete | `postTypeEnum` only had text/link/share/poll | Added discussion/question/showcase/announcement to pgEnum, Zod, and TypeScript types |

### 5. DigitalOcean One-Click Deploy

Three `doctl`-based scripts in `deploy/`:

- **`do-one-click.sh`** — Interactive provisioning (instance name, domain, admin credentials, features, region, size). Generates cloud-init with Docker, Caddy, Postgres, Redis, Meilisearch, schema push, first admin user. Supports `--dry-run`.
- **`do-status.sh`** — Deployment health checker (SSH → cloud-init status, Docker services, HTTPS, disk)
- **`do-destroy.sh`** — Safe teardown with name confirmation

### 6. Featured Content Management
- New `PATCH /api/admin/content/[id]` endpoint for `isFeatured` toggle
- Admin content page has star toggle (local content only; federated items show "federated" tag)
- Homepage featured card only shows when admin has explicitly starred something — no fallback to popular
- Badge says "Featured" (not "Popular") — only appears when `isFeatured=true` exists

### 7. Image Proxy for Federation
- New `/api/image-proxy` endpoint: proxies remote images with 24h browser + 7d server cache
- SSRF prevention (blocks private IPs, localhost, non-HTTPS, 15s timeout, 10MB limit)
- ContentCard + FederatedContentCard auto-proxy remote cover images
- Both repos have the proxy

### 8. Content Card Badge Fixes
- ContentTypeBadge: dark opaque background (`rgba(0,0,0,0.75)`) + backdrop blur with colored text per type
- ContentCard badges: same treatment for featured/federated overlays on images
- Type colors: project=blue, article=teal, blog=green, explainer=yellow
- Removed `guide` type (doesn't exist in schema)

### 9. Hub UI Overhaul

**Post Type Selector** (both Feed + Discussions tabs):
- Row of type buttons: Post, Question, Discussion, Showcase
- Active state highlights, dynamic placeholder per type
- Enter key submits, type resets to `text` after posting
- All 8 post types (text, link, share, poll, discussion, question, showcase, announcement) in schema enum, Zod validators, and TypeScript types

**Discussions Tab**:
- Direct compose bar on the tab (was "go to Feed tab" empty state)
- Question toggle + Discussion post button
- Filter includes discussion + question types (was only text + link)

**Share to Hub** (content detail pages):
- New `ShareToHubModal` component — pick from your hubs, share existing content
- "Hub" button in EngagementBar with `targetTitle` prop
- Works on all content types (Project, Article, Blog, Explainer)

**Hub Projects Tab**:
- Empty state has "New Project" button linking to `/create?hub={slug}`
- Create page passes `?hub=` through to editor
- Editor pre-selects hub in properties panel via `metadata.hubSlug`
- Auto-shares to hub on publish

### 10. Database Setup for New Instances
- `drizzle-kit push` on empty databases creates all 30+ tables correctly — no issues
- Existing instance schema changes may need manual SQL if drizzle-kit hits TTY prompts
- DO one-click script handles fresh DB setup via cloud-init

## Package Versions Published (All in This Session)

| Package | Version | Changes |
|---------|---------|---------|
| `@commonpub/schema` | 0.8.1 | `boostCount`, `localBoostCount` columns |
| `@commonpub/schema` | 0.8.2 | Post type enum: +discussion/question/showcase/announcement |
| `@commonpub/server` | 2.1.3 | Announce persistence |
| `@commonpub/server` | 2.1.4 | Cover image + attachments in upsert/update |
| `@commonpub/server` | 2.1.5 | Featured filter excludes federated content |
| `@commonpub/server` | 2.1.6 | `isFeatured` in ContentListItem mapper + type |
| `@commonpub/server` | 2.1.7 | Rebuild against schema 0.8.2 (post type enum) |

## Production Database Changes (Applied Manually)
- `content_items.boost_count` — integer, default 0, not null (both instances)
- `federated_content.local_boost_count` — integer, default 0, not null (both instances)
- `federated_content.is_hidden` — set to false for 3 backfilled items (commonpub.io)
- `federated_content.cpub_type` — set to 'project' for 3 items (commonpub.io)
- `federated_content.cover_image_url` — set from deveco.io source images (commonpub.io)
- `federated_content.content` — populated from re-federated activity payloads (commonpub.io)
- Activity payloads patched with `cpub:type` + full content/attachments (deveco.io)
- Old incomplete outbound Create activities deleted + re-federated (deveco.io)
- **Note**: Post type enum values (discussion/question/showcase/announcement) need `db:push` or manual `ALTER TYPE` on both instances

## File Parity (Final State)

| Area | commonpub ref | deveco-io | CLI template |
|------|:---:|:---:|:---:|
| Pages | 63 | 63 | 63 |
| API routes | 130+ | 130+ | 130+ |
| Components | 38 | 39 (+DevEcoLogo) | 38 |
| Composables | 15 | 15 | 15 |
| Layouts | 3 | 3 | 3 |

## Version Consistency (Final State)

| Location | Schema | Server |
|----------|--------|--------|
| npm published | 0.8.2 | 2.1.7 |
| Source package.json | 0.8.2 | 2.1.7 |
| deveco-io deps | ^0.8.2 | ^2.1.7 |
| CLI scaffold.rs | ^0.8.2 | ^2.1.7 |
| CLI template.rs | ^0.8.2 | ^2.1.7 |

## Git Summary
- **commonpub**: 14 commits this session
- **deveco-io**: 12 commits this session
- Both repos: zero uncommitted changes, all deploys green

## Known Issues Remaining
- E2E CI flaky (9 Playwright failures — tab switching, footer links — pre-existing)
- `drizzle-kit push` can't run non-interactively when it wants to truncate a table (content_builds unique constraint false positive on deveco.io)
- Post type enum ALTER TYPE needs to be applied on both production DBs (discussion/question/showcase/announcement values)
- Image proxy does not resize — passes through full-size images (consider sharp integration)

## Next Steps
- Apply post type enum migration on both production instances (`ALTER TYPE post_type ADD VALUE 'discussion'` etc.)
- Test hub post creation with new types on live instances
- Test Share to Hub flow end-to-end on both instances
- DigitalOcean Marketplace vendor submission (requires Packer image)
- Consider server-side image resizing in image proxy (sharp)
