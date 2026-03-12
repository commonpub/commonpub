# Session 008: ActivityPub Federation (Phase 8)

## What Was Done

### Pre-Implementation

- Research doc: `docs/research/federation-system.md` — Prior art from Mastodon/Lemmy/Misskey, Fedify API patterns, HTTP Signature gotchas, content mapping
- ADR 019: `docs/adr/019-federation-architecture.md` — Fedify integration strategy, schema, activity scope, queue architecture

### Step 1: Schema Extensions (15 tests)

- 3 new enums in `packages/schema/src/enums.ts`: `activityDirectionEnum`, `activityStatusEnum`, `followRelationshipStatusEnum`
- 4 new tables in `packages/schema/src/federation.ts`: `remoteActors`, `activities`, `followRelationships`, `actorKeypairs`
- 7 new Zod validators in `packages/schema/src/validators.ts` for federation inputs
- Tests in `packages/schema/src/__tests__/federation.test.ts`

### Step 2: Activity Types + Content Mapper (37 tests)

- `packages/protocol/src/activityTypes.ts` — 9 activity types (Create/Update/Delete/Follow/Accept/Reject/Undo/Like/Announce), 3 object types (Article/Note/Tombstone), collection types
- `packages/protocol/src/activities.ts` — 9 pure builder functions
- `packages/protocol/src/contentMapper.ts` — 4 pure mapping functions (contentToArticle, contentToNote, articleToContent, noteToComment)

### Step 3: Actor Resolution (13 tests)

- `packages/protocol/src/actorResolver.ts` — Zod-validated actor parsing, WebFinger discovery, inbox extraction

### Step 4: Keypair Management (6 tests)

- `packages/protocol/src/keypairs.ts` — RSA 2048 via jose library, PEM export, Key ID builder

### Step 5: Inbox/Outbox Processing (18 tests)

- `packages/protocol/src/inbox.ts` — processInboxActivity router with InboxCallbacks interface
- `packages/protocol/src/outbox.ts` — OrderedCollection and page generation
- Decided against Fedify integration in protocol package (kept pure TS) — Fedify integration deferred to app layer when Fedify is installed

### Step 6: Queue Worker (10 tests)

- `tools/worker/src/index.ts` — Delivery stats, retry logic, exponential backoff, activity log formatting
- Architecture decision: Use Fedify's built-in message queue instead of separate BullMQ worker

### Step 7: Federation Server Functions

- `apps/reference/src/lib/server/federation.ts` — 12 server functions: keypair management, actor resolution with caching, follow/accept/reject/unfollow, content federation hooks, followers/following queries, activity log

### Step 8: AP Routes

- `.well-known/webfinger` — GET, delegates to protocol
- `.well-known/nodeinfo` — GET
- `nodeinfo/2.1` — GET with user/post counts
- `users/[username]` — GET returns AP actor JSON (content-negotiated)
- `users/[username]/inbox` — POST processes inbound activities
- `users/[username]/outbox` — GET ordered collection
- `users/[username]/followers` — GET collection
- `users/[username]/following` — GET collection
- `inbox` — POST shared inbox
- `api/federation/follow` — POST send follow
- `api/federation/follow/[id]` — DELETE unfollow
- `api/federation/follow/[id]/accept` — POST
- `api/federation/follow/[id]/reject` — POST

### Step 9: Content Publishing Hooks

- `onContentPublished`, `onContentUpdated`, `onContentDeleted` in content.ts
- `onContentLiked` in social.ts
- All conditional on `config.features.federation`

### Step 10: OAuth2 SSO Flow

- `api/auth/oauth2/authorize` — Provider: authorization endpoint
- `api/auth/oauth2/token` — Provider: token exchange
- `api/auth/oauth2/callback` — Consumer: handle redirect
- `auth/federated` — Federated login form with WebFinger discovery

### Step 11: Federation Dashboard UI

- Dashboard page at `(app)/dashboard/federation`
- 4 components: ActivityLog, FollowRequests, TrustedInstances, RemoteActorCard
- All using `var(--*)` tokens, keyboard accessible

### Step 12: Multi-Instance Dev Setup

- `deploy/docker-compose.federation.yml` — Two Postgres instances + shared Redis
- `deploy/federation-seed.ts` — Creates users, content, OAuth clients with mutual trust

### Step 13: Hooks + Feature Flag Wiring

- Added `federation` and `communities` feature flags to hooks.server.ts
- Federation defaults to `false` (opt-in via `FEATURE_FEDERATION=true`)

## Decisions Made

1. **Fedify's built-in queue** over separate BullMQ — simplifies architecture
2. **Pure TS protocol package** — no Fedify dependency in @commonpub/protocol; Fedify integration at app layer
3. **jose library** for RSA keypair generation (Web Crypto compatible)
4. **Auto-accept follows** in v1 — manual approval deferred
5. **Content federation hooks** as standalone functions called by routes (not embedded in CRUD)
6. **Shared inbox** logs activities but delegates to per-user handlers

## Test Counts

| Package            | Before | After | New     |
| ------------------ | ------ | ----- | ------- |
| @commonpub/schema   | 43     | 58    | +15     |
| @commonpub/protocol | 42     | 116   | +74     |
| @commonpub/worker   | 1      | 10    | +9      |
| **Phase 8 total**  |        |       | **+98** |
| **All packages**   | 700    | 734   |         |

## Open Questions

1. HTTP Signature verification not yet implemented in inbox handler — needs Fedify
2. Authorization code storage for OAuth2 — in-memory for v1, needs Redis/DB
3. Remote content display — inbox handlers are stubs for Create/Update/Delete
4. E2E tests with two instances — deferred to Phase 9

## Next Steps

- Phase 9: Install @fedify/fedify, wire up real HTTP Signature verification
- Phase 9: Mastodon/Pleroma compatibility testing
- Phase 9: Media proxy for remote images
- Phase 9: Rate limiting on inbox
