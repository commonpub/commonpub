# Federation Interoperability Audit

> Generated: 2026-04-01 (Session 098)
> Status: Active tracking document — update as items are resolved

## Overview

This document tracks every gap between local and federated experiences on CommonPub instances. The goal is full interoperability: a user on commonpub.io interacting with deveco.io content should feel identical to a local user on deveco.io, wherever technically feasible.

---

## 1. Bugs (broken behavior)

### 1.1 Fork button crashes on federated content
- **Location:** `components/views/ProjectView.vue:258-267`
- **Issue:** Calls `/api/content/${content.id}/fork` with the transformed federated content's ID (a UUID from `federated_content` table), not a local `content_items` ID. The fork endpoint will 404.
- **Fix:** Detect `federatedId` prop; fetch `cpubBlocks` from the federated content, create a new local draft from blocks.
- **Severity:** High — button visible, crashes on click

### 1.2 "I Built This" button crashes on federated content
- **Location:** `components/views/ProjectView.vue:274-285`
- **Issue:** Same as fork — calls `/api/content/${content.id}/build` with a federated content UUID.
- **Fix:** Either disable for federated content, or create a local "built this" record keyed to `federatedContentId`.
- **Severity:** High — button visible, crashes on click

### 1.3 Bookmark silently no-ops on federated content
- **Location:** `composables/useEngagement.ts:133-134`
- **Issue:** `if (isFederated.value) return;` — button renders and appears clickable but does nothing, no user feedback.
- **Fix:** Either support bookmarking federated content (store federated content ID in bookmarks) or hide the button and show a tooltip.
- **Severity:** Medium — misleading UI

### 1.4 Author link goes to nonexistent local profile
- **Location:** `components/views/ProjectView.vue:329-341`
- **Issue:** Author name links to `/u/${content.author.username}` which is a local route. For federated content, this username doesn't exist locally — 404.
- **Fix:** For federated content, link to `/federation/users/${authorHandle}` or the remote profile page. The `authorHandle` (e.g., `@user@deveco.io`) is available from `useMirrorContent`.
- **Severity:** High — broken navigation

### 1.5 onUpdate handler missing cpubMetadata, cpubBlocks, tags
- **Location:** `packages/server/src/federation/inboxHandlers.ts:585-629`
- **Issue:** The `onUpdate` handler updates title, content, summary, url, attachments, coverImageUrl, and cpubType — but NOT cpubMetadata, cpubBlocks, or tags. These are only handled in the onCreate/upsert path.
- **Fix:** Add cpubMetadata, cpubBlocks, and tags extraction to `onUpdate`, same as onCreate.
- **Severity:** Medium — updates to federated content lose extension data

### 1.6 ExplainerView missing like support for federated content
- **Location:** `components/views/ExplainerView.vue:83`
- **Issue:** Only destructures `bookmarked, toggleBookmark, share` from `useEngagement` — no `toggleLike` or `liked` or `likeCount`. Other view components (Project, Article, Blog) all include like.
- **Fix:** Add `liked, likeCount, toggleLike` to the destructured values and render the like button.
- **Severity:** Low — explainers are less common content type

### 1.7 Hub posts lose post_type on federation
- **Location:** `packages/server/src/federation/inboxHandlers.ts` (Announce handler)
- **Issue:** When a hub Announce is received and the inner Note is dereferenced, the `post_type` is set to `'text'` for all posts. The original post type (discussion, question, showcase, share) is not preserved in the AP object.
- **Fix:** Add `cpub:postType` extension to hub post Announce activities; extract on ingest.
- **Severity:** Low — affects hub feed filtering/display

---

## 2. Missing features (expected but not built)

### 2.1 Comments write-only on federated content
- **Location:** `components/CommentSection.vue:34-39`
- **Issue:** Comment fetch is skipped for federated content (`immediate: !props.federatedContentId`). User can write a reply (sends AP Note) but never sees existing replies — not their own, not others'.
- **Fix phase 1:** Show a "Reply sent to origin" confirmation after submitting.
- **Fix phase 2:** Fetch remote replies by dereferencing the content's `replies` collection from the origin server, or query local `activities` table for inbound replies.
- **Severity:** High — comments are core social feature

### 2.2 Local notifications not wired
- **Location:** `packages/server/src/social/social.ts`, `layers/base/server/api/social/`
- **Issue:** `createNotification()` is NEVER called from local social actions (like, comment, follow). Only federated inbound actions (via `inboxHandlers.ts:notifyRemoteInteraction`) trigger notifications.
- **Fix:** Call `createNotification()` in `toggleLike()`, `createComment()`, `followUser()` when the target content has a different author than the acting user.
- **Severity:** High — this is a local bug, not just federation. No user on any instance gets notifications for local interactions.
- **Note:** Notification infrastructure is complete (schema, API, SSE stream, client composable). Only the trigger calls are missing.

### 2.3 No "Follow on Fediverse" button on mirror pages
- **Issue:** Mirror page shows the author's name but no way to follow them. The remote actor search + follow flow exists (`/api/federation/follow`) but there's no UI entry point on the mirror page.
- **Fix:** Add a "Follow" button next to author name that calls `/api/federation/follow` with the author's actor URI (available from federated content record).
- **Severity:** Medium

### 2.4 Federated content not indexed in Meilisearch
- **Location:** `packages/server/src/federation/timeline.ts:399-425`
- **Issue:** `searchFederatedContent()` uses Postgres ILIKE which is slow and misses fuzzy/typo matching. Local content uses Meilisearch. Federated content is never added to the search index.
- **Fix:** Index federated content in Meilisearch on ingest (in `onCreate` handler). Include origin domain and cpub:type in searchable attributes.
- **Severity:** Medium — affects discoverability

### 2.5 No fork endpoint for federated content
- **Issue:** Forking is a key CommonPub feature (build on someone else's project). No API endpoint accepts a federated content ID and creates a local draft from its blocks.
- **Fix:** Create `/api/federation/fork` that reads `cpubBlocks` from `federated_content`, creates a new local `content_items` draft with those blocks, and attributes the original.
- **Severity:** Medium — key differentiator feature

### 2.6 Can't share federated content to local hub
- **Issue:** The "Share to hub" flow (`/api/hubs/[slug]/share`) expects a local content ID.
- **Fix:** Accept federated content ID, create hub post with `sharedContentMeta` pointing to the federated content.
- **Severity:** Low

### 2.7 Tags not clickable on mirror page
- **Location:** `components/views/ProjectView.vue:354`, mirror fallback in `pages/mirror/[id].vue:71`
- **Issue:** Tags render as `<span>` elements, not `<NuxtLink>` to `/tags/[slug]`.
- **Fix:** Wrap tags in NuxtLink. For federated content, the tag slug should be derived from the tag name.
- **Severity:** Low — easy fix

### 2.8 Attachments not rendered
- **Issue:** Federated content receives attachments (documents, extra images) but only cover image is displayed. Other attachments are stored in the `attachments` jsonb column but not rendered.
- **Fix:** Render attachment list in view components when `federatedId` is present and attachments exist.
- **Severity:** Low

### 2.9 View tracking for federated content
- **Issue:** Viewing a mirror page doesn't increment any counter. Local content tracks views via `/api/content/[id]/view`.
- **Fix:** Add a view counter to `federated_content` table, increment on mirror page load.
- **Severity:** Low

### 2.10 Remote author profile incomplete
- **Issue:** `remoteActors` cache stores: actorUri, inbox, username, displayName, summary, avatarUrl, domain, followerCount, followingCount. But mirror page only shows name + avatar. No bio, banner, website, follower count.
- **Fix:** Enrich the author block on mirror pages with data from `remoteActors`.
- **Severity:** Low

### 2.11 No RSS for federated hubs
- **Issue:** Local hubs have `/api/hubs/[slug]/feed.xml`. Federated hubs have no RSS equivalent.
- **Fix:** Generate RSS from `federated_hub_posts` for each federated hub.
- **Severity:** Very low

### 2.12 No DM initiation to remote users
- **Issue:** Can receive DMs from remote users (private AP Notes → conversation), but no UI to initiate a DM to a remote user.
- **Fix:** Add "Message" button on remote user profile that creates a local conversation and sends a private Note.
- **Severity:** Low

---

## 3. Design decisions (intentionally not federated)

These are instance-local by design and should NOT be federated:

- **Docs** — versioned site content, instance-specific
- **Learning paths** — enrollment, progress, certificates are instance-local
- **Contests** — judging workflow is instance-local
- **Videos** — category management is instance-local
- **Hub membership/roles/bans** — local governance (hub federation is Group actor follow, not full membership sync)
- **Content versions/history** — local editing history
- **Hub gallery** — local media
- **Hub invites** — local membership management

---

## 4. Non-CommonPub interop (Mastodon, Lemmy, etc.)

| Aspect | Status | Notes |
|--------|--------|-------|
| Content appears as Article | Works | Title, content HTML, cover image, tags all work |
| cpub: extensions ignored | Expected | Non-CP instances see plain Article |
| Likes from Mastodon | Works | Increments local counter |
| Boosts from Mastodon | Works | Announce handling processes any actor |
| Replies from Mastodon | Works | Note with inReplyTo, increments comment count |
| Follows from Mastodon | Works | Auto-accept, content delivered to followers |
| Hub Group actors vs Lemmy | Untested | Lemmy uses Group differently — may not interop |
| WebFinger discovery | Works | Standard implementation |
| NodeInfo | Works | Returns correct software info |

---

## 5. What works well (preserve these)

- cpub:blocks round-trip preserving full content structure
- View component reuse (same ProjectView for local + federated)
- Federated likes with optimistic UI
- Federated replies via AP Note with inReplyTo
- Inbound notification wiring (remote like/follow/comment/boost → notification)
- HTTP Signature signing/verification
- Circuit breaker + exponential backoff delivery
- Instance mirroring with content type + tag filters
- CLI refederation via x-admin-secret header
- seamlessFederation flag mixing federated content into local listings
- Content sanitization on ingest (security boundary)

---

## 6. Implementation priority

### Phase A — Fix broken buttons (1-2 hours)
- [ ] 1.1 Fork: disable or adapt for federated content
- [ ] 1.2 "I Built This": disable for federated content
- [ ] 1.3 Bookmark: hide button or support federated content ID
- [ ] 1.4 Author link: route to federation profile
- [ ] 1.5 onUpdate: add cpubMetadata, cpubBlocks, tags
- [ ] 1.6 ExplainerView: add like support
- [ ] 2.7 Tags: make clickable

### Phase B — Wire local notifications (30 min)
- [ ] 2.2 Call createNotification from toggleLike, createComment, followUser

### Phase C — Comment visibility (1-2 hours)
- [ ] 2.1 Phase 1: "Reply sent" confirmation
- [ ] 2.1 Phase 2: Fetch remote replies collection or show local activity log

### Phase D — Federation depth (3-4 hours)
- [ ] 2.3 "Follow remote author" button on mirror pages
- [ ] 2.4 Index federated content in Meilisearch on ingest
- [ ] 2.5 Fork federated content (create local draft from cpubBlocks)
- [ ] 1.7 Hub post type preservation (cpub:postType extension)

### Phase E — Polish (2-3 hours)
- [ ] 2.6 Share federated content to local hub
- [ ] 2.8 Render attachments on federated content
- [ ] 2.9 View tracking for federated content
- [ ] 2.10 Enrich remote author profiles
- [ ] 2.11 RSS for federated hubs
- [ ] 2.12 DM initiation to remote users
