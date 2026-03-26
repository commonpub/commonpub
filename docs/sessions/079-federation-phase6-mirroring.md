# Session 079 — Federation Phase 6: Instance Mirroring

**Date**: 2026-03-26
**Scope**: @commonpub/schema + @commonpub/server + deveco-io

## What Was Done

### Phase 6 of 7 in the full federation implementation plan.

**Goal**: Instance B can subscribe to Instance A as a mirror — all published content from A is automatically replicated to B, with configurable filters.

### Schema Changes
- **New enums**: `mirror_status` (pending/active/paused/failed), `mirror_direction` (pull/push)
- **New table**: `instanceMirrors` — remoteDomain (unique), remoteActorUri, status, direction, filterContentTypes (JSONB), filterTags (JSONB), contentCount, errorCount, lastError, lastSyncAt
- **federatedContent**: added `mirrorId` (FK to instanceMirrors), `isHidden` (boolean for admin control), index on mirrorId

### Mirroring Module (`federation/mirroring.ts`)
- `createMirror(db, remoteDomain, remoteActorUri, direction, filters?)` — creates pending mirror
- `activateMirror/pauseMirror/resumeMirror(db, mirrorId)` — lifecycle management
- `cancelMirror(db, mirrorId)` — deletes mirror config (content preserved)
- `listMirrors(db)` / `getMirror(db, mirrorId)` — query mirrors with stats
- `matchMirrorForContent(db, originDomain, apType, cpubType, tags)` — checks active pull mirrors, applies content type and tag filters, increments stats
- `recordMirrorError(db, mirrorId, error)` — tracks errors for admin visibility

### Inbox Integration
- `onCreate` in `inboxHandlers.ts` now calls `matchMirrorForContent()` before inserting
- If a mirror matches, `mirrorId` is set on the stored `federatedContent` row
- Stats (contentCount, lastSyncAt) updated atomically

### Content Filters
- **Type filter**: accepts only specified content types (e.g., `['article', 'project']`)
- **Tag filter**: accepts only content with at least one matching tag (case-insensitive, # stripped)
- **Null filter = accept all**: omitting a filter means no restriction
- Filters are AND-ed: content must pass all configured filters

### deveco-io Admin Routes (5 new)
- `GET /api/admin/federation/mirrors` — list all mirrors
- `POST /api/admin/federation/mirrors` — create mirror
- `GET /api/admin/federation/mirrors/[id]` — get mirror detail
- `PUT /api/admin/federation/mirrors/[id]` — pause/resume
- `DELETE /api/admin/federation/mirrors/[id]` — cancel mirror

### Anti-Loop Architecture
Three layers of protection prevent A → B → A loops:

1. **Origin domain check** (inboxHandlers `onCreate`): Content with `objectUri` hostname matching local domain is rejected before storage
2. **Inbound-only storage**: Inbound Create activities store content but NEVER generate outbound activities
3. **Mirror direction**: Pull mirrors only accept content from the configured `remoteDomain`, not from any arbitrary source

### Tests Added: 17 new
- Mirror lifecycle: create (pending), activate, pause, resume, list, cancel
- Content filtering: accepts matching type, rejects non-matching, null for unknown domain, skips paused mirrors
- Tag filtering: accepts matching tag, rejects non-matching, case-insensitive
- Anti-loop: local domain content rejected, inbound does NOT trigger outbound
- Mirror ingestion: mirrorId set on stored content, contentCount incremented

## Test Results
- **@commonpub/server**: 34 files, 409 tests (408 passed, 1 skipped)
- **Build**: Clean TypeScript compilation

## Cumulative Totals (Phases 1-6)
- **New tests**: 95 (22 + 12 + 22 + 9 + 13 + 17)
- **@commonpub/server total**: 409 tests
- **deveco-io new files**: 30+

## Next Steps (Phase 7: Federated Search + Polish)
- Index remote_content in Meilisearch
- Add scope param to search API (local/federated/all)
- Exponential backoff on delivery retries
- Dead instance detection
- Shared inbox deduplication
