# Session 076 — Federation Phase 3: Federated Timeline + Inbound Storage

**Date**: 2026-03-26
**Scope**: @commonpub/server + deveco-io

## What Was Done

### Phase 3 of 7 in the full federation implementation plan.

**Goal**: Content received from remote instances via inbox Create activities is stored, queryable, and interactable.

### Inbox Handler Upgrades (@commonpub/server)

**onCreate** — now stores content in `federatedContent` table:
- Parses AP object (Article, Note, any type)
- Sanitizes HTML content via `sanitizeHtml()` from protocol
- Extracts tags, attachments, cover image, CommonPub extensions (`cpub:type`, `cpub:metadata`)
- Upserts on `objectUri` (deduplication — same content arriving twice won't create duplicates)
- **Loop prevention**: rejects content where `objectUri` hostname matches local domain
- Links to cached `remoteActors` row via FK

**onUpdate** — updates existing `federatedContent`:
- Sanitizes updated content and summary
- Only updates rows that exist (no-op if content wasn't previously stored)

**onDelete** — soft-deletes via `deletedAt`:
- Only sets `deletedAt` on rows with `deletedAt IS NULL` (idempotent)
- Content hidden from timeline but row preserved for audit

**onLike** — enhanced to handle federated content:
- After checking local `contentItems`, also checks `federatedContent` by `objectUri`
- Increments `localLikeCount` on matching federated content

### Timeline Module (new: `federation/timeline.ts`)
- `listFederatedTimeline(db, opts)` — paginated query with filters (apType, cpubType, originDomain), joined with actor info, excludes deleted
- `getFederatedContent(db, id)` — single item by ID with actor join
- `likeRemoteContent(db, userId, id, domain)` — increments localLikeCount + queues outbound Like
- `boostRemoteContent(db, userId, id, domain)` — queues outbound Announce
- All return `FederatedContentItem` type with resolved actor profile

### deveco-io API Routes (4 new)
- `GET /api/federation/timeline` — paginated with limit/offset/apType/cpubType/originDomain filters
- `GET /api/federation/content/[id]` — single federated content item
- `POST /api/federation/like` — like remote content
- `POST /api/federation/boost` — boost remote content
- All gated with `requireFeature('federation')`

### deveco-io Frontend (2 new files)
- `components/FederatedContentCard.vue` — card with origin badge, type badge, actor info, like/boost buttons, safe text rendering (no v-html)
- `pages/federation/index.vue` — timeline page with infinite scroll, link to search

### Content Types Covered
| AP Type | CommonPub Type | Tested |
|---------|---------------|--------|
| Article | (any) | ✓ stores, queries, likes |
| Note | (post) | ✓ stores, queries |
| Article | project | ✓ cpub:type extracted |
| Article | blog | (same code path) |
| Article | explainer | (same code path) |
| — | — with BOM | ✓ cpub:metadata stored |

### Interaction Types Covered
| Interaction | Direction | Status |
|-------------|-----------|--------|
| Like local content | Inbound | ✓ increments likeCount |
| Like federated content | Inbound | ✓ increments localLikeCount |
| Like federated content | Outbound | ✓ queues Like activity |
| Boost federated content | Outbound | ✓ queues Announce activity |
| Unlike local content | Outbound | ✓ (Phase 1) |
| Delete (Tombstone) | Inbound | ✓ soft-deletes |
| Update | Inbound | ✓ updates stored content |
| Create | Inbound | ✓ stores with sanitization |

### Bug Fixes from Audit
- **onUpdate NULL overwrite**: Update handler was setting omitted fields to `undefined` which Drizzle treated as NULL. Fixed to build update payload dynamically — only provided fields are updated, others preserved.
- **Like dedup**: `likeRemoteContent` had no idempotency check — same user could inflate `localLikeCount`. Fixed by checking for existing outbound Like activity before incrementing.

### Tests Added: 22 new
- **federated-timeline.integration.test.ts** (20 tests):
  - Inbound Create: Article with all fields, Note, CommonPub-typed content
  - HTML sanitization: strips script tags, event handlers
  - Deduplication: same objectUri upserts correctly
  - Loop prevention: rejects content from local domain
  - Inbound Update: modifies stored content, sanitizes
  - Inbound Delete: soft-deletes, excluded from timeline
  - Timeline: ordered by receivedAt, pagination, apType filter, originDomain filter, excludes deleted
  - getFederatedContent: returns by ID, null for missing
  - likeRemoteContent: increments count + creates outbound activity, false for missing
  - boostRemoteContent: creates outbound Announce, false for missing

## Files Changed

### commonpub (10 files, +945/-53, 3 new files)
- `packages/server/src/federation/inboxHandlers.ts` — onCreate/onUpdate/onDelete/onLike upgraded
- `packages/server/src/federation/timeline.ts` — NEW: timeline queries + interactions
- `packages/server/src/federation/index.ts` — export timeline module
- `packages/server/src/index.ts` — barrel exports
- `packages/server/src/__tests__/federated-timeline.integration.test.ts` — NEW: 20 tests

### deveco-io (6 new files)
- `server/api/federation/timeline.get.ts`
- `server/api/federation/content/[id].get.ts`
- `server/api/federation/like.post.ts`
- `server/api/federation/boost.post.ts`
- `components/FederatedContentCard.vue`
- `pages/federation/index.vue`

## Test Results
- **@commonpub/server**: 32 files, 372 tests (371 passed, 1 skipped)
- **Build**: Clean TypeScript compilation

## Cumulative Totals (Phases 1-3)
- **New tests**: 56 (22 Phase 1 + 12 Phase 2 + 22 Phase 3)
- **commonpub files changed**: 10 modified, 4 new
- **deveco-io files**: 4 modified, 14 new

## Next Steps (Phase 4: Reply/Comment Federation)
- Add `remoteUri`, `remoteActorUri` to `comments` table
- `federateReply()` for outbound comments on remote content
- Upgrade inbox `onCreate` for Note with `inReplyTo`
- Remote comment badges in CommentSection.vue
