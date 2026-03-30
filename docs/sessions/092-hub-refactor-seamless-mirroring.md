# Session 092 — Hub Refactor + Seamless Hub Mirroring + Federation Wiring

**Date**: 2026-03-30
**Scope**: commonpub monorepo + deveco-io — hub module split, component extraction, seamless hub mirroring (schema → server → UI → inbox wiring → tests)

## Context

Session 091 shipped hub federation but left 1400-line hub.ts, 1400-line hub page, bolted-on useEngagement routing, and no seamless hub mirroring. This session refactored all debt and built the complete hub mirroring pipeline.

---

## What Was Done

### 1. Hub Server Split (hub.ts → 4 modules)

`packages/server/src/hub/hub.ts` (1430 lines) → 4 files:

| File | Content |
|------|---------|
| `hub.ts` (~220 lines) | listHubs, getHubBySlug, createHub, updateHub, deleteHub |
| `posts.ts` (~500 lines) | Posts, replies, likes, content sharing |
| `members.ts` (~240 lines) | join, leave, getMember, listMembers, changeRole, kickMember |
| `moderation.ts` (~270 lines) | Bans + invites |

Dependency graph: `moderation.ts` → none. `members.ts` → moderation. `posts.ts` → moderation. `hub.ts` → moderation. Acyclic.

### 2. Hub Page Component Extraction

`deveco-io/pages/hubs/[slug]/index.vue` (1385 lines) → ~200 lines. Extracted:
- `hub/HubHero.vue` — Banner, meta bar, badges, join/share
- `hub/HubFeed.vue` — Compose bar, feed filters, post list, share cards
- `hub/HubDiscussions.vue` — Discussion compose + list
- `hub/HubMembers.vue` — Members grid
- `hub/HubProjects.vue` — Gallery + project picker modal
- `hub/HubProducts.vue` — Products grid
- `hub/HubSidebar.vue` — Moderators, rules, links (with `.cpub-sb-card` / `.cpub-sb-title` styles)

### 3. useEngagement Refactor

Positional params → `EngagementOptions` object:
```typescript
useEngagement({ contentId, contentType, federatedContentId })
```
- `isFederated` computed exposed
- Bookmark skips for federated content (was silently failing)
- All 5 consumers updated

### 4. Mirror Content Composable

`useMirrorContent(fedContent)` extracted from mirror page:
- Content parsing (BlockTuple JSON or HTML)
- Metadata extraction, view component resolution
- Origin domain, author handle computeds

### 5. Seamless Hub Mirroring — Schema

Two new tables in `packages/schema/src/federation.ts`:

**`federatedHubs`**: actorUri (unique), remoteSlug, name, description, iconUrl, bannerUrl, hubType, remoteMemberCount, remotePostCount, localPostCount, status (pending/accepted/rejected), followActivityUri, originDomain, url, rules, categories, isHidden. Indexes: (status, isHidden), name, remoteActorId, originDomain.

**`federatedHubPosts`**: federatedHubId (FK cascade), objectUri (unique), actorUri, remoteActorId, content, postType, isPinned, localLikeCount, localReplyCount, remoteLikeCount, remoteReplyCount, publishedAt, receivedAt, deletedAt. Indexes: federatedHubId, receivedAt.

### 6. Seamless Hub Mirroring — Server

`federation/hubMirroring.ts`:
- **followRemoteHub()** — Insert-or-update with `onConflictDoNothing` + separate update (reliable created detection)
- **sendHubFollow()** — Resolves remote actor, stores follow relationship, queues Follow from instance Service actor
- **acceptHubFollow()** — Transitions pending → accepted
- **unfollowRemoteHub()** — Hides and rejects
- **listFederatedHubs()** — Queries accepted + non-hidden with search/pagination
- **getFederatedHub()** / **getFederatedHubByActorUri()** — Single hub lookup (accepted-only)
- **ingestFederatedHubPost()** — Insert-or-update with `onConflictDoNothing` + separate update (no double-counting)
- **listFederatedHubPosts()** — With remote actor join, pagination
- **deleteFederatedHubPost()** — Soft-delete with actorUri validation
- **likeFederatedHubPost()** / **unlikeFederatedHubPost()** — Local engagement counters

**listHubs()** updated with `includeFederated` option — fetches both sources, merges by date, paginates the merged result.

### 7. Seamless Hub Mirroring — Inbox Handler Wiring

In `inboxHandlers.ts`:

**onAccept**: After existing followRelationships check, calls `acceptHubFollow(actorUri)` to transition federated hub from pending → accepted.

**onAnnounce**: Detects Group actors in `federatedHubs` (accepted-only). When matched:
1. Loop prevention: skips Announces of own domain's content
2. Dereferences Note URI via HTTP GET with 10s timeout
3. Handles `attributedTo` as string, object with id, or array (AP spec)
4. Resolves post author via resolveRemoteActor
5. Calls `ingestFederatedHubPost()` with content

**onDelete**: After existing federated content soft-delete, calls `deleteFederatedHubPost(objectId, actorUri)` with actor validation.

### 8. API Routes (deveco-io)

- `GET /api/hubs` — Passes `includeFederated: true` when seamlessFederation + federateHubs enabled
- `GET /api/admin/federation/hub-mirrors` — List federated hubs (admin)
- `POST /api/admin/federation/hub-mirrors` — Follow remote hub + queue Follow activity (admin)
- `GET /api/federated-hubs/[id]` — Federated hub detail
- `GET /api/federated-hubs/[id]/posts` — Federated hub posts

### 9. UI (deveco-io)

- Hubs index: federated hubs with dashed border, globe badge, origin domain
- Federated hub detail page: federation banner, hub header, post feed with remote author info
- `CommentSection`: accepts `federatedContentId`, routes to `/api/federation/reply`, shows federation notice

### 10. Federated Interaction Audit + Fixes

| Interaction | Status | Fix |
|-------------|--------|-----|
| Like | OK | — |
| Comment | Fixed | CommentSection routes to federation/reply when federated, skips local fetch |
| Bookmark | Fixed | useEngagement skips toggle for federated content |
| Fork | Not implemented | Noted for future |
| Boost | Partial | Endpoint exists, UI not on mirror pages |

### 11. Integration Tests (27 tests)

`hub-mirroring.integration.test.ts` — real PGlite database tests:
- followRemoteHub: create, update on duplicate, preserves status
- acceptHubFollow: pending→accepted, idempotent, unknown actor
- getFederatedHubByActorUri: returns accepted, rejects pending
- listFederatedHubs: filters by status+hidden, search
- ingestFederatedHubPost: create with count increment, no double-count on upsert, multiple posts
- listFederatedHubPosts: listing, author info, pagination
- deleteFederatedHubPost: soft-delete with count, rejects wrong actor, idempotent
- like/unlike: increment, decrement, floor at zero
- listHubs with includeFederated: local-only, merged, search
- unfollowRemoteHub: hides from all listings

---

## Packages Changed

| Package | Version | Changes |
|---------|---------|---------|
| @commonpub/schema | 0.8.5 | federatedHubs + federatedHubPosts tables, indexes, types, relations |
| @commonpub/server | 2.3.4 | hub.ts split (4 modules), hubMirroring.ts, listHubs includeFederated, inbox handler wiring, 27 new tests |
| deveco-io | — | 7 hub components, useEngagement refactor, useMirrorContent composable, federation routes + pages, CommentSection federation |

---

## Security Measures

- `getFederatedHubByActorUri()` only returns accepted hubs — posts not ingested before follow handshake
- `deleteFederatedHubPost()` validates actorUri matches post author
- Loop prevention in onAnnounce — skips Announces from own domain
- `attributedTo` type handling covers string, object, and array per AP spec
- Note dereferencing has 10s timeout via AbortSignal
- Bookmark silently skips for federated content instead of failing

---

## Known Remaining Work

- **Hub outbox backfill** — On Accept, backfill existing posts from remote hub outbox
- **Federated hub post interactions** — Like/reply UI not yet wired
- **Boost UI on mirror pages** — Endpoint exists but not exposed
- **Follow federated content author** — Actor URI extraction needed
- **Fork federated content** — New endpoint needed
- **Database migrations** — drizzle-kit push on production
- **Share card backfill migration** — Convert N+1 runtime to SQL
- **Repo sync automation** — Stop manual file copying

---

## Next Session Priorities

1. Deploy: drizzle-kit push on both instances, test end-to-end hub mirroring
2. Federated hub post interactions: like/reply UI wiring
3. Hub outbox backfill on Accept
4. Package version bumps + publish
