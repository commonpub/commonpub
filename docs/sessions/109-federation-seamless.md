# Session 109 — Seamless Cross-Instance Federation

**Date:** 2026-04-06
**Goal:** Make hubs feel like one platform across instances.

## What Was Done

### P1: Federated Reply Display
- Made `hubPostReplies.authorId` nullable
- Added `remoteActorUri`, `remoteActorName` columns to `hubPostReplies`
- Inbox handler (`onCreate`) now INSERTs federated replies into `hubPostReplies` with null authorId
- `listReplies` changed from INNER JOIN to LEFT JOIN on users
- Hub post detail page shows remote replies with globe icon badge
- **5 integration tests** added

### P2: Remote Member Posts on Host Hub
- Made `hubPosts.authorId` nullable
- Added `remoteActorUri`, `remoteActorName` columns to `hubPosts`
- Inbox handler: when `hubContext` is set and actor is an accepted hub follower, Create(Note) creates a local hub post
- Respects `cpub:postType` extension for post type preservation
- Non-followers are rejected (no post created)
- `listPosts` and `getPostById` changed to LEFT JOIN
- Hub feed shows remote posts with instance domain handle
- Hub post detail page shows remote author with globe badge
- **6 integration tests** added

### P3: Per-User Hub Join Tracking
- New `userFederatedHubFollows` table in federation schema
- Hub-follow API creates per-user record on join (upsert)
- Status is 'pending' until instance-level Accept, then promoted to 'joined'
- `acceptHubFollow` promotes all pending user follows for the hub
- New `/api/federation/hub-follow-status` GET endpoint for per-user state
- Federated hub page shows personal join state (not instance-level)
- **4 integration tests** added

### P4: Remote Members in Member List
- New `listRemoteMembers` function queries `hubFollowers` + `remoteActors`
- Members API includes `remoteMembers` array when federation is enabled
- `HubMembers.vue` component renders federated members section with globe badges
- **3 integration tests** added

### P5: Comment Threading UI
- `CommentSection.vue` now renders threaded comments (was flat)
- Reply button on each comment, "replying to" indicator
- Child comments indented with border-left thread line
- `parentId` passed to comment creation API
- Server already returned tree structure — only UI was missing

### P6: Cleanup
- Deleted old `[type]/[slug]/index.vue` and `[type]/[slug]/edit.vue` redirect pages
- Server middleware `content-redirect.ts` handles 301 redirects
- `[type]/index.vue` listing page retained (valid route)
- Docs content column still `text` in schema (not `jsonb`) — needs separate migration

## Test Results
- **26/26 typecheck** passing
- **804 server tests** (18 new) + 1 skipped
- **373 protocol tests** passing
- **181 explainer tests** passing

## Files Changed (summary)

### Schema
- `packages/schema/src/hub.ts` — nullable authorId on hubPosts + hubPostReplies, remote actor columns
- `packages/schema/src/federation.ts` — new `userFederatedHubFollows` table

### Server
- `packages/server/src/federation/inboxHandlers.ts` — federated reply insert, hub member post creation
- `packages/server/src/federation/hubFederation.ts` — null-safe authorId checks
- `packages/server/src/federation/hubMirroring.ts` — promote user follows on Accept
- `packages/server/src/hub/posts.ts` — LEFT JOIN queries, null-safe notification guards
- `packages/server/src/hub/members.ts` — `listRemoteMembers` function
- `packages/server/src/hub/index.ts` — export new function + type
- `packages/server/src/index.ts` — export new function + type
- `packages/server/src/types.ts` — nullable author on HubPostItem + HubReplyItem

### Layer (UI)
- `layers/base/pages/hubs/[slug]/posts/[postId].vue` — remote author rendering
- `layers/base/pages/hubs/[slug]/index.vue` — remote member display, remote post author
- `layers/base/pages/federated-hubs/[id]/index.vue` — per-user join state
- `layers/base/components/hub/HubMembers.vue` — federated members section
- `layers/base/components/CommentSection.vue` — threaded comments with reply UI
- `layers/base/server/api/federation/hub-follow.post.ts` — per-user record creation
- `layers/base/server/api/federation/hub-follow-status.get.ts` — new endpoint
- `layers/base/server/api/hubs/[slug]/members.get.ts` — include remote members

### Tests (22 new)
- `federated-hub-replies.integration.test.ts` (6 tests) — insert, count, listReplies, delete, empty content, XSS
- `remote-hub-member-posts.integration.test.ts` (9 tests) — create, reject, types, list, delete, idempotency, reply-not-post, invalid type
- `per-user-hub-join.integration.test.ts` (4 tests) — pending, multiple users, accept promotion, upsert
- `remote-hub-members.integration.test.ts` (3 tests) — accepted only, pending excluded, missing actor

### Deleted
- `layers/base/pages/[type]/[slug]/index.vue`
- `layers/base/pages/[type]/[slug]/edit.vue`

## Post-Implementation Audit — Bugs Found & Fixed

### Critical: Empty reply incremented count without storing
Reply count was incremented even when `replyContent` was empty (no row inserted). Moved count increment + notification inside the `if (replyContent)` guard.

### Critical: Reply Notes treated as hub posts in hub inbox
Notes with `inReplyTo` pointing to non-hub-post URLs (local content, remote content) entered the hub-post-creation block and were silently dropped. Changed condition from `!isReplyToLocalHubPost` to `!inReplyTo` — only Notes without any inReplyTo are treated as new hub posts.

### High: Missing schema relations & type exports
`userFederatedHubFollows` had no Drizzle relations and no type exports. Added `userFederatedHubFollowsRelations` and `UserFederatedHubFollowRow` / `NewUserFederatedHubFollowRow`.

### Medium: Duplicate hub posts on AP retry
No idempotency check for hub member posts. Added activity-table dedup check before creating the post.

### Medium: Invalid cpub:postType crashed Postgres INSERT
Remote instance sending invalid enum value caused silent post loss. Added validation against known values with 'text' fallback.

### Medium: Reply button blocked on federated replies
Template required `reply.author` to be truthy, hiding the reply button for federated replies (null author). Removed the guard, using `reply.author?.username ?? reply.remoteActorName` for the @mention.

### Medium: Type mismatch in membersData fetch
`useLazyFetch` type didn't include `remoteMembers`. Fixed the generic type parameter and removed unsafe cast.

## Open Questions
- Docs content column TEXT→JSONB migration needs a separate session (data conversion required)
- `docsNav` table is still dead code — can remove if nav tree is not planned
- Remote member post creation doesn't send Announce back to followers (host hub should relay)
- `federateHubPost` and `federateHubPostUpdate` use INNER JOIN on users — won't fire for federated posts (correct for now, but blocks future Announce relay)
- Anonymous visitors trigger a wasted `/api/federation/hub-follow-status` request on federated hub pages

## Infrastructure Fixes (Post-Deploy)

### drizzle-kit push was silently failing on both instances
Root cause chain: (1) `zod` not installed in Docker runtime stage — schema dist imports it; (2) `| tee` pipe masked the exit code; (3) `type:module` missing from runtime package.json (ESM/CJS hang); (4) `DATABASE_URL` env var not set — config fell back to localhost; (5) on deveco.io, `npm install` wiped the manually-copied schema dist.

Fixes applied across 3 commits:
- `Dockerfile`: added `zod` to npm install, added `"type":"module"` to package.json
- `deploy.yml`: replaced `| tee` with `> file` redirect for proper exit code detection
- `apps/reference/drizzle.config.js`: added `NUXT_DATABASE_URL` fallback
- `deveco-io/Dockerfile`: moved COPY of schema dist to AFTER npm install

Both instances now show `✅ db:push succeeded` in deploy logs. Future schema changes will auto-apply.

## Deployment Status

**DEPLOYED** to both instances on 2026-04-07:
- commonpub.io: code + schema + drizzle infra fix ✅
- deveco.io: code + schema + drizzle infra fix ✅

## Next Steps
- Test cross-instance flow: create a hub on deveco.io, join from commonpub.io, post + reply across instances
- Add Announce relay for remote member posts (so the host hub's followers see them)
- Guard the `hub-follow-status` fetch behind `isAuthenticated` to avoid wasted requests for anonymous visitors
