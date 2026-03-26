# Session 074 — Federation Phase 1: Wire Outbound Events

**Date**: 2026-03-26
**Scope**: @commonpub/server + deveco-io

## What Was Done

### Phase 1 of 7 in the full federation implementation plan.

**Problem**: The delivery worker (30s polling) existed but most content/social actions never created activities to deliver. Only `onContentPublished` was wired in deveco-io. Several bugs in the existing delivery/federation code were also found and fixed.

### Bug Fix 1: `federateDelete` URI mismatch
- `federateDelete` used UUID-based URIs (`/content/${contentId}`)
- `contentToArticle` uses slug-based URIs (`/content/${slug}`)
- Remote instances couldn't match Delete activities to the original Create
- **Fix**: `federateDelete` now looks up the content slug before constructing the URI, with UUID fallback if content is fully purged

### Bug Fix 2: `Undo(Like)` delivery would fail
- `resolveTargetInboxes` treated all `Undo` activities like `Undo(Follow)` — looking up `objectUri` as a remote actor URI
- But `Undo(Like)` has a content URI as `objectUri`, not an actor URI
- Result: Undo(Like) would always fail with "No target inboxes found"
- **Fix**: `resolveTargetInboxes` now distinguishes Undo subtypes — checks if `objectUri` matches a remote actor; if not, fans out to all followers (same as Like)

### Bug Fix 3: `federateContent`/`federateUpdate` lacked published status guard
- Could be called on draft/archived content, creating invalid federation activities
- **Fix**: Both now check `content.status === 'published'` before creating activities
- Defense-in-depth: deveco-io routes already guard, but the server layer is now self-defensive

### New Functions in @commonpub/server
- `federateUnlike(db, userId, contentUri, domain)` — creates Undo(Like) activity
- `onContentUnliked(db, userId, contentUri, config)` — hook wrapping federateUnlike
- `buildContentUri(domain, slug)` — consistent slug-based URI construction
- `getContentSlugById(db, contentId)` — lookup helper for like route

### deveco-io Route Wiring
| Route | Hook Added |
|-------|-----------|
| `PUT /api/content/[id]` | `onContentUpdated` (only for published content) |
| `DELETE /api/content/[id]` | `onContentDeleted` (after soft-delete, slug available) |
| `POST /api/social/like` | `onContentLiked` / `onContentUnliked` (content types only, not posts/comments) |

### Tests Added: 22 new tests
- **federation-hooks.integration.test.ts** (13 new, 23 total):
  - Delete URI uses slug matching Create URI
  - Like activity has correct AP structure
  - Undo(Like) activity has correct AP structure
  - onContentLiked: creates Like, no-op when disabled, handles missing user
  - onContentUnliked: creates Undo, no-op when disabled
  - buildContentUri: correct URI format
  - getContentSlugById: returns slug, returns null for missing
  - federateDelete: uses slug even after soft delete
  - Draft content is not federated (Create guard)
  - Draft content is not federated (Update guard)

- **delivery.integration.test.ts** (9 new):
  - Create/Update/Delete/Like target correct inboxes (followers)
  - Undo(Like) fans out to followers, not to objectUri as actor
  - Skip activities with no followers (marks as failed)
  - Status transitions: pending→failed after MAX_ATTEMPTS
  - Accept targets original Follow actor

## Decisions Made

1. **Only federate updates to published content** — editing a draft doesn't need to reach remote inboxes
2. **Only federate likes on content types** — post and comment likes are local-only for now
3. **Both like and unlike federate** — proper Undo(Like) for AP compliance
4. **Slug-based URIs everywhere** — consistent with contentToArticle, not UUID-based

## Files Changed

### commonpub (8 files, +400/-6)
- `packages/server/src/federation/federation.ts` — federateDelete fix, published guards, federateUnlike, buildContentUri, getContentSlugById
- `packages/server/src/federation/delivery.ts` — Undo(Like) inbox resolution fix
- `packages/server/src/federation/index.ts` — export new functions
- `packages/server/src/social/social.ts` — onContentUnliked hook
- `packages/server/src/social/index.ts` — export onContentUnliked
- `packages/server/src/index.ts` — barrel exports
- `packages/server/src/__tests__/federation-hooks.integration.test.ts` — 11 new tests
- `packages/server/src/__tests__/delivery.integration.test.ts` — 9 new tests (new file)

### deveco-io (3 files, +40/-3)
- `server/api/content/[id]/index.put.ts` — wire onContentUpdated
- `server/api/content/[id]/index.delete.ts` — wire onContentDeleted
- `server/api/social/like.post.ts` — wire onContentLiked/onContentUnliked

## Test Results
- **@commonpub/server**: 30 files, 337 tests (336 passed, 1 skipped)
- **Build**: Clean TypeScript compilation, zero errors

## Recursion Analysis (for future phases)
- Phase 1 has no recursion risk: inbound handlers just log (don't re-federate)
- Phase 3+ must ensure: `remote_content` table is separate from `contentItems` — publishing remote content must NOT trigger outbound federation hooks
- Phase 6 (mirroring): instance mirroring MUST track content origin to prevent loops. A → B mirror should never cause B → A to re-federate A's own content back. The `remote_content.remoteUri` uniqueness constraint and origin domain tracking prevent this.

## Known Issues
- deveco-io typecheck fails with drizzle-orm type mismatch due to `pnpm-workspace.yaml` linking — pre-existing, not introduced by this change
- New deveco-io exports require commonpub v0.6.0 publish before npm install will work (currently using workspace link)

## Next Steps (Phase 2)
- Remote follow UI + remote actor viewing
- Schema: new `remote_content` table, add columns to `remoteActors`
- Server: `searchRemoteActor()`, `sendFollow()` exposed via API
- Frontend: `RemoteUserSearch.vue`, `RemoteActorCard.vue`, `/federation/search` page
