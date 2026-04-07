# Session 110 — Federation UX Fixes

**Date:** 2026-04-06
**Goal:** Fix the 3 federation UX bugs found during live cross-instance testing in session 109.

## What Was Done

### P1: Federated Hub Post Replies Now Stored + Displayed Locally

When a user on the mirroring instance replies to a federated hub post, the reply was previously sent via AP but NOT stored locally. The federated post detail page had no reply fetching or display — just a static "replies sent via federation" message.

**Schema:**
- New `federatedHubPostReplies` table in `packages/schema/src/federation.ts`
  - `id`, `federatedHubPostId` (FK cascade), `authorId` (FK cascade), `parentId` (self-ref), `content`, `createdAt`, `updatedAt`
  - Indices on `federatedHubPostId` and `authorId`
- Updated `federatedHubPostsRelations` to include `replies: many(federatedHubPostReplies)`
- New `federatedHubPostRepliesRelations` with parent/children threading via `fedReplyThread`
- Exported `FederatedHubPostReplyRow` and `NewFederatedHubPostReplyRow` types

**Server:**
- New `FederatedHubPostReplyItem` type (non-nullable `author: UserRef`, optional threading)
- `createFederatedHubPostReply()` — inserts reply, increments `localReplyCount`, returns with author
- `listFederatedHubPostReplies()` — paginated list with threaded structure (same pattern as `listReplies`)
- Both exported through `federation/index.ts` → server `index.ts`

**API:**
- Modified `POST /api/federation/hub-post-reply` — now stores locally FIRST, then sends via AP fire-and-forget. Return type changed from `{ success: boolean }` to `FederatedHubPostReplyItem`. Added `parentId` support.
- New `GET /api/federated-hubs/[id]/posts/[postId]/replies` — lists local replies with pagination

**UI:**
- `federated-hubs/[id]/posts/[postId].vue` — fetches + displays local replies with threading, reply-to indicator, MentionText rendering, reply button per comment, nested children display
- Replaced the static "Federated thread" empty state with actual reply list + "View full thread on origin" link

### P2: Instance Domain Next to Federated Reply Usernames

On the local hub post detail page, federated replies showed globe icon + `remoteActorName` but no instance domain.

**Fix:**
- Added `extractDomain(uri)` helper that parses hostname from `remoteActorUri`
- Added `@domain` display after remote actor names on posts and replies (root + nested)
- CSS: `.cpub-remote-domain` styling (10px, faint text)

### P3: Federated User Avatars via LEFT JOIN on remoteActors

The `remoteActors` table caches `avatarUrl` from resolved actors, but hub post replies and posts only stored `remoteActorUri` + `remoteActorName`. Avatars were never displayed for federated users.

**Server:**
- Added `remoteActorAvatarUrl?: string | null` to both `HubReplyItem` and `HubPostItem` types
- `listReplies()` — added LEFT JOIN on `remoteActors` via `hubPostReplies.remoteActorUri = remoteActors.actorUri`
- `listPosts()` — added LEFT JOIN on `remoteActors` via `hubPosts.remoteActorUri = remoteActors.actorUri`
- `getPostById()` — added same LEFT JOIN

**UI:**
- `hubs/[slug]/posts/[postId].vue` — added `remoteActorAvatarUrl` as avatar fallback for posts and replies (root + nested)
- `hubs/[slug]/index.vue` — added `remoteActorAvatarUrl` as avatar fallback for post cards

## Audit Findings (Fixed)

1. **Missing Drizzle relation** — `federatedHubPostsRelations` didn't include `replies: many(federatedHubPostReplies)`. Fixed.
2. **Non-null assertion risk** — `author!` in `createFederatedHubPostReply` relied on assumption that auth user exists. Added explicit throw guard.
3. **Reply content rendering inconsistency** — Federated page used `{{ reply.content }}` instead of `<MentionText>`. Fixed to use `MentionText` for consistency with local hub pages.

## Test Results

- **26/26 typecheck** passing
- **823 server tests** (+15 new), 1 skipped (pre-existing)
- **373 protocol tests** passing
- **181 explainer tests** passing
- **143 docs tests** passing

### New Tests (15 total)

**`federated-hub-post-local-replies.integration.test.ts`** (9 tests):
- Creates reply with correct author info
- Increments localReplyCount
- Lists replies with author info and correct total
- Threaded replies with parentId
- Empty list for post with no replies
- Increments count for each reply
- Multiple users reply independently
- Pagination limit/offset
- Throws on reply to nonexistent post (FK constraint)

**`federated-avatar-resolution.integration.test.ts`** (6 tests):
- listReplies returns avatarUrl for federated reply with cached avatar
- listReplies returns null avatarUrl without cached avatar
- listReplies returns null avatarUrl when no remote actor record exists
- listPosts returns avatarUrl for federated post
- listPosts returns null avatarUrl for local posts
- getPostById returns avatarUrl for federated post

## Files Changed

### Schema
- `packages/schema/src/federation.ts` — new table, relations, types

### Server
- `packages/server/src/types.ts` — new `FederatedHubPostReplyItem`, added `remoteActorAvatarUrl` to `HubReplyItem` + `HubPostItem`
- `packages/server/src/federation/hubMirroring.ts` — new `createFederatedHubPostReply()`, `listFederatedHubPostReplies()`, updated imports
- `packages/server/src/federation/index.ts` — re-export new functions
- `packages/server/src/index.ts` — re-export new functions + type
- `packages/server/src/hub/posts.ts` — LEFT JOIN `remoteActors` in `listReplies`, `listPosts`, `getPostById`

### Layer (UI)
- `layers/base/pages/federated-hubs/[id]/posts/[postId].vue` — reply fetch + display + threading
- `layers/base/pages/hubs/[slug]/posts/[postId].vue` — `extractDomain()`, `@domain` display, avatar fallback
- `layers/base/pages/hubs/[slug]/index.vue` — avatar fallback

### API
- `layers/base/server/api/federation/hub-post-reply.post.ts` — local storage + AP fire-and-forget
- `layers/base/server/api/federated-hubs/[id]/posts/[postId]/replies.get.ts` — NEW

### Tests (15 new)
- `federated-hub-post-local-replies.integration.test.ts` (9 tests)
- `federated-avatar-resolution.integration.test.ts` (6 tests)

## Design Decisions

1. **New table vs reusing `hubPostReplies`** — Used a new `federatedHubPostReplies` table because `hubPostReplies.postId` has an FK to `hubPosts.id`, not `federatedHubPosts.id`. Reusing would require making the FK nullable or adding a second FK column, both worse than a clean separate table.

2. **INNER JOIN vs LEFT JOIN in `listFederatedHubPostReplies`** — Used INNER JOIN on `users` because all replies in this table are from local users (authorId is NOT NULL). This differs from `listReplies` which uses LEFT JOIN because `hubPostReplies` can have federated replies with null authorId.

3. **Store locally first, then AP** — Changed from AP-only to local-first because users should see their own replies immediately. AP delivery is fire-and-forget with `.catch()` — if the remote hub is unreachable, the reply still appears locally.

4. **LEFT JOIN for avatars** — Chose LEFT JOIN on `remoteActors` by `actorUri` instead of adding a denormalized `remoteActorAvatarUrl` column to `hubPostReplies`/`hubPosts`. The JOIN approach keeps avatars fresh (if the remote actor's avatar is re-fetched, all posts/replies automatically show the new one) and avoids schema migration.

## Deployment Status

**NOT YET DEPLOYED** — Needs:
1. `pnpm publish` for updated packages (schema, server, layer)
2. Deploy to both instances (drizzle-kit push will create the new table)

## Next Steps

- Deploy to both instances
- Live test: reply to a federated hub post on deveco.io, verify reply appears locally AND is delivered to commonpub.io
- Live test: verify avatar resolution for remote members on both instances
- Remove the 3 HIGH federation UX bugs from MEMORY.md outstanding work
