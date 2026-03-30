# Session 091 — Hub Federation Wiring + Hub Bug Fixes

**Date**: 2026-03-29
**Scope**: commonpub monorepo + deveco-io — wire up hub federation, fix hub posting bug, add project association UI

## Context

Hub federation infrastructure was fully built (sessions 087-088) but never wired to production code. `federateHubPost()`, `federateHubShare()`, `handleHubFollow()` existed as dead code. Additionally, discussion/post creation in hubs was broken (400 error) and there was no way to associate existing projects with a hub.

## 1. Hub Post Creation 400 Bug — FIXED

**Root cause**: `createPostSchema` required `hubId` as mandatory UUID in the request body, but the client sends only `{ content, type }` since the hub is identified by slug in the URL. Validation failed before the server could inject hubId.

**Fix**:
- `packages/schema/src/validators.ts` — made `hubId` optional in `createPostSchema`
- `apps/reference/server/api/hubs/[slug]/posts/index.post.ts` — changed to `readBody()` + `safeParse()` with injected hubId (matching the replies endpoint pattern)
- Same fix applied to deveco-io

## 2. Duplicate Share Prevention

- `packages/schema/src/hub.ts` — added `unique('uq_hub_shares_hub_content').on(t.hubId, t.contentId)`
- `packages/server/src/hub/hub.ts` — added duplicate check in `shareContent()` before insert

**Note**: Requires migration to add the unique constraint to existing databases.

## 3. "Add Existing Project" to Hub — NEW FEATURE

Added ability for hub members to share their existing published projects to a hub from the Projects tab.

- `pages/hubs/[slug]/index.vue` (both repos) — added:
  - "Add Existing Project" button (visible to hub members on non-product hubs)
  - Project picker modal fetching user's published projects via `/api/content?authorId=...&type=project`
  - `shareProjectToHub()` handler using existing `/api/hubs/[slug]/share` endpoint
  - Modal CSS styles matching design system

## 4. Hub Federation — 6 Phases Implemented

### Phase 1: Feature Flag Enforcement
- `routes/hubs/[slug].ts` (both repos) — gates on `features.federateHubs` alongside `features.federation`
- `routes/hubs/[slug]/inbox.ts` (both repos) — same

### Phase 2: Hub Outbox + Followers Collection Routes
- **NEW** `routes/hubs/[slug]/outbox.ts` (both repos) — paginated Announce activities
- **NEW** `routes/hubs/[slug]/followers.ts` (both repos) — OrderedCollection of follower URIs
- `packages/server/src/federation/outboxQueries.ts` — added `countHubOutboxItems()`, `getHubOutboxPage()`
- `packages/protocol/src/outbox.ts` — added `baseUriOverride` parameter to collection builders

### Phase 3: Outbound Post + Share Federation
- `packages/server/src/federation/hubFederation.ts`:
  - Added `hubPostToNote()` — builds Note with proper URI `/hubs/{slug}/posts/{postId}`
  - Added `getHubPostNoteUri()` — URI helper
  - Fixed Note URI (was using generic `/comments/` path)
- `packages/protocol/src/activityTypes.ts` — added optional `context` field to `APNote`
- **NEW** `routes/hubs/[slug]/posts/[postId].ts` (both repos) — serves hub post as AP Note JSON-LD
- `api/hubs/[slug]/posts/index.post.ts` (both repos) — wired `federateHubPost()` (fire-and-forget)
- `api/hubs/[slug]/share.post.ts` (both repos) — wired `federateHubShare()` (fire-and-forget)

### Phase 4: Outbound Delete Federation
- `packages/server/src/federation/hubFederation.ts` — added `federateHubPostDelete()`
- `api/hubs/[slug]/posts/[postId].delete.ts` (both repos) — wired deletion federation

### Phase 5: Hub Follow Routing
- `packages/server/src/federation/inboxHandlers.ts`:
  - Added `hubContext?: { hubSlug: string }` to `InboxHandlerOptions`
  - `onFollow`: routes to `handleHubFollow()` when hubContext set (writes to `hubFollowers`, not `followRelationships`)
  - `onUndo(Follow)`: routes to `handleHubUnfollow()` when hubContext set
- `routes/hubs/[slug]/inbox.ts` (both repos) — passes `hubContext` to `createInboxHandlers()`

### Phase 6: Likes on Hub Posts
- `packages/server/src/federation/inboxHandlers.ts`:
  - `onLike`: handles hub post Note URIs (`/hubs/{slug}/posts/{postId}`) and resolves Announce activity URIs back to hub posts
  - `onUndo(Like)`: same resolution logic for decrements

## Audit Results

### Second-pass audit found and fixed:

1. **XSS vulnerability in federated hub post content** — `hubPostToNote()` was putting raw user input directly into AP Note `content` field without HTML escaping. Fixed by:
   - Exporting `escapeHtmlForAP()` from `@commonpub/protocol` (was file-private in `contentMapper.ts`)
   - Importing and using it in `hubPostToNote()` in `hubFederation.ts`
   - Also applying it in the hub post Note dereference route (`routes/hubs/[slug]/posts/[postId].ts`) in both repos

2. **Undo(Like) asymmetry for Announce activity IDs** — `onLike` resolved Announce activity IDs to hub posts (line 732-758), but `onUndo(Like)` did not, meaning likes via Announce ID could be counted but never decremented. Fixed by adding matching Announce resolution to the Undo(Like) handler.

3. **Unused import** — removed `remoteActors` from `hubFederation.ts` imports (first-pass catch).

4. **Empty state button logic** — removed misleading "New Project" button for non-members; replaced with contextual copy.

### Final verification:
- All imports valid, no unused imports
- Types match between callers and callees
- SQL queries correct (including JSONB `payload->>'id'` matching)
- Feature flag checks consistent across all 5 routes
- Content HTML-escaped in all federated output
- Like/Unlike symmetry verified (both direct Note URI and Announce ID resolution)
- No null pointer risks
- Both repos in sync
- 847 server+protocol tests pass, zero failures

## Files Changed

### commonpub monorepo

| File | Change |
|------|--------|
| `packages/schema/src/validators.ts` | `hubId` optional in createPostSchema |
| `packages/schema/src/hub.ts` | unique constraint on hubShares |
| `packages/protocol/src/activityTypes.ts` | `context?` field on APNote |
| `packages/protocol/src/outbox.ts` | `baseUriOverride` parameter |
| `packages/protocol/src/contentMapper.ts` | exported `escapeHtmlForAP` |
| `packages/protocol/src/index.ts` | added `escapeHtmlForAP` export |
| `packages/server/src/hub/hub.ts` | duplicate share check |
| `packages/server/src/federation/hubFederation.ts` | `hubPostToNote`, `federateHubPostDelete`, `getHubPostNoteUri`, removed unused import |
| `packages/server/src/federation/inboxHandlers.ts` | `hubContext` routing, hub post Like handling |
| `packages/server/src/federation/outboxQueries.ts` | `countHubOutboxItems`, `getHubOutboxPage` |
| `packages/server/src/federation/index.ts` | new exports |
| `packages/server/src/index.ts` | new re-exports |
| `apps/reference/server/routes/hubs/[slug].ts` | federateHubs flag |
| `apps/reference/server/routes/hubs/[slug]/inbox.ts` | federateHubs flag + hubContext |
| `apps/reference/server/routes/hubs/[slug]/outbox.ts` | **NEW** |
| `apps/reference/server/routes/hubs/[slug]/followers.ts` | **NEW** |
| `apps/reference/server/routes/hubs/[slug]/posts/[postId].ts` | **NEW** |
| `apps/reference/server/api/hubs/[slug]/posts/index.post.ts` | post fix + federation wiring |
| `apps/reference/server/api/hubs/[slug]/posts/[postId].delete.ts` | federation wiring |
| `apps/reference/server/api/hubs/[slug]/share.post.ts` | federation wiring |
| `apps/reference/pages/hubs/[slug]/index.vue` | project picker + empty state fix |

### deveco-io (mirrored)
All route/API/page changes mirrored identically.

## Known Issues / Not in Scope

- Remote posting to hubs (FEP-1b12 allows it but needs moderation queue)
- Boost/Announce counting on hub posts (no `boostCount` column)
- Remote replies to hub posts (needs mapping to `hubPostReplies`)
- Hub privacy enforcement in federation
- Migration needed for `uq_hub_shares_hub_content` constraint

## Next Steps

1. Run `drizzle-kit generate` + `drizzle-kit migrate` on both instances for the unique constraint
2. Set `features.federateHubs: true` on both instances
3. Test end-to-end: create hub post on commonpub.io, verify Announce delivered to deveco.io followers
4. Test hub Follow from deveco.io to commonpub.io hub
5. Test Like on hub post from remote instance
