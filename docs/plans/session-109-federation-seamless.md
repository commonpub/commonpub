# Plan: Session 109 — Seamless Cross-Instance Federation

> Goal: Make hubs feel like one platform across instances. A user on commonpub.io interacting with a hub on deveco.io should see replies, members, and posts as if they were local.

## Priority 1: Federated Reply Display

**Problem:** Remote replies to hub posts increment the count and notify the author, but the reply text is not stored locally. Users see "3 replies" but only local replies appear.

**Root cause:** `hubPostReplies` requires `authorId` (NOT NULL FK to local users). Remote actors don't have local user records.

**Fix — Option A (recommended): Add remote actor columns to hubPostReplies**

```sql
ALTER TABLE hub_post_replies
  ADD COLUMN remote_actor_uri TEXT,
  ADD COLUMN remote_actor_name TEXT,
  ALTER COLUMN author_id DROP NOT NULL;
```

Schema change in `packages/schema/src/hub.ts`:
- Make `authorId` nullable: `.references(() => users.id, { onDelete: 'cascade' })` → remove `.notNull()`
- Add `remoteActorUri: text('remote_actor_uri')`
- Add `remoteActorName: text('remote_actor_name')`

Then in `packages/server/src/federation/inboxHandlers.ts` (the hub reply handler added in session 108):
- Insert into `hubPostReplies` with `authorId: null`, `remoteActorUri`, `remoteActorName`, `content`

Display in `layers/base/pages/hubs/[slug]/posts/[postId].vue` and federated equivalent:
- Reply component already renders `reply.author.username` — add fallback to `reply.remoteActorName`
- Show federation badge (globe icon) for remote replies

**Files to modify:**
- `packages/schema/src/hub.ts` — schema change
- `packages/server/src/federation/inboxHandlers.ts` — insert reply on hub post reply
- `packages/server/src/hub/posts.ts` — `getPostReplies()` to include remote actor info
- `layers/base/pages/hubs/[slug]/posts/[postId].vue` — render remote replies
- `layers/base/pages/federated-hubs/[id]/posts/[postId].vue` — same

**Tests:**
- Integration test: simulate remote Create(Note) with inReplyTo hub post → verify reply stored + count incremented
- Unit test: reply display with remote actor fallback

---

## Priority 2: Remote Member Posts on Host Hub

**Problem:** When a user on commonpub.io writes a post on a deveco.io-hosted hub, the Create(Note) is sent to deveco.io's hub inbox. But deveco.io's inbox handler doesn't create a local hub post from it.

**Root cause:** The hub inbox (`layers/base/server/routes/hubs/[slug]/inbox.ts`) routes to `createInboxHandlers()` with `hubContext`. The `onCreate` handler processes the Note as generic federated content, not as a hub post.

**Fix:** In `inboxHandlers.ts` `onCreate`, when `hubContext` is set and the activity is a Create(Note):
1. Check if the actor is a known follower of the hub (in `hubFollowers` table)
2. If yes, create a local `hubPost` entry attributed to a proxy/remote author
3. The hub post appears in the hub feed like a local post but with a federation badge

**Alternative (simpler):** Store the post in `federatedHubPosts` with `postType: 'member-post'` and display it alongside local posts in the hub feed. This avoids modifying `hubPosts` (which requires `authorId` as NOT NULL FK).

**Files to modify:**
- `packages/server/src/federation/inboxHandlers.ts` — handle Create(Note) in hub context
- `packages/server/src/federation/hubMirroring.ts` — `ingestFederatedHubPost()` may need adaptation
- `layers/base/pages/hubs/[slug]/index.vue` — merge federated posts into feed
- `layers/base/components/hub/HubFeed.vue` — render remote member posts

---

## Priority 3: Per-User Hub Join Tracking

**Problem:** Clicking "Join" on a federated hub sends a Follow from the instance actor, not the user. All users on the instance share the join state. There's no per-user "am I a member?" tracking.

**Fix:**
1. New table `userHubFollows` (or `userFederatedHubFollows`):
   ```
   id, userId, federatedHubId, status ('pending'|'joined'), joinedAt
   ```
2. When user clicks Join:
   - Create record in `userHubFollows` with status 'pending'
   - If instance hasn't already followed the hub, send the Follow activity
   - When Accept comes back, update ALL pending `userHubFollows` for that hub to 'joined'
3. UI reads from `userHubFollows` to show per-user join state
4. Member count shows local user count (from `userHubFollows`) + remote followers

**Files to modify:**
- `packages/schema/src/federation.ts` — new table
- `layers/base/server/api/federation/hub-follow.post.ts` — create user follow record
- `packages/server/src/federation/hubMirroring.ts` — update user records on Accept
- `layers/base/pages/federated-hubs/[id]/index.vue` — read per-user join state

---

## Priority 4: Remote Members in Member List

**Problem:** Hub member list only shows local members from `hubMembers` table. Remote followers (in `hubFollowers`) aren't displayed.

**Fix:** In the members list component/API:
1. Query `hubFollowers` for the hub's remote followers
2. Resolve remote actor names from `remoteActors` cache
3. Display with federation badge, link to remote profile

**Files to modify:**
- `packages/server/src/hub/members.ts` — include remote followers in member list query
- `layers/base/pages/hubs/[slug]/members.vue` — render remote members section

---

## Priority 5: Comment Threading

**Problem:** Comments on content are flat — no threading. Schema has `parentId` but UI ignores it.

**Fix:**
1. Comment API already stores `parentId`
2. Frontend `CommentSection.vue` needs:
   - "Reply" button on each comment
   - Tree rendering (indent children under parent)
   - Collapse/expand for deep threads
3. API may need to return comments in tree structure or include `parentId` for client-side tree building

**Files to modify:**
- `layers/base/components/CommentSection.vue` — tree rendering + reply UI
- `packages/server/src/social/social.ts` — ensure `parentId` is returned in comment list

---

## Priority 6: Cleanup & Small Fixes

- **Remove old redirect pages** — `[type]/[slug]/index.vue` and `edit.vue` are now redundant (middleware handles 301). Delete them.
- **Docs content TEXT→JSONB** — already in schema, should auto-apply on deploy via drizzle push. Verify.
- **docsNav dead code** — remove or implement nav tree rendering.

---

## Estimated Effort

| Priority | Task | Estimate |
|----------|------|----------|
| P1 | Federated reply display | 1-2 hours |
| P2 | Remote member posts on host hub | 2-3 hours |
| P3 | Per-user hub join tracking | 2-3 hours |
| P4 | Remote members in member list | 30 min |
| P5 | Comment threading | 2-3 hours |
| P6 | Cleanup | 30 min |

P1-P4 are one session. P5 could be same session or next.
