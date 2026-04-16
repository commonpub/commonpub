# Federation Architecture Map

Comprehensive reference for every federation-related component, data flow, database table, API route, and UI surface in CommonPub. Updated 2026-04-03.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Protocol Layer](#protocol-layer)
4. [Server Layer](#server-layer)
5. [API Routes](#api-routes)
6. [UI Components & Pages](#ui-components--pages)
7. [Content Type Matrix](#content-type-matrix)
8. [Activity Flow Diagrams](#activity-flow-diagrams)
9. [OAuth SSO Flow](#oauth-sso-flow)
10. [Hub Federation](#hub-federation)
11. [Instance Mirroring](#instance-mirroring)
12. [Security Model](#security-model)
13. [Feature Flags](#feature-flags)
14. [Known Issues](#known-issues)

---

## System Overview

```
                         ┌─────────────────────────────┐
                         │      Remote Instance         │
                         │  (CommonPub / Mastodon /     │
                         │   Lemmy / GoToSocial)        │
                         └──────┬──────────────┬────────┘
                                │              │
                     HTTP Sig   │              │  HTTP Sig
                     POST       │              │  POST
                                ▼              ▼
┌───────────────────────────────────────────────────────────────┐
│                       Local Instance                          │
│                                                               │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────┐ │
│  │  Protocol    │   │   Server     │   │   Layer (UI)       │ │
│  │  Package     │   │   Package    │   │                    │ │
│  │             │   │              │   │  Pages:            │ │
│  │  - WebFinger │   │  - Inbox     │   │  - /fediverse      │ │
│  │  - NodeInfo  │   │  - Delivery  │   │  - /federated-hubs │ │
│  │  - Signing   │   │  - OAuth     │   │  - /auth/oauth     │ │
│  │  - Types     │   │  - Mirroring │   │                    │ │
│  │  - Mapper    │   │  - Timeline  │   │  Components:       │ │
│  │  - Resolver  │   │  - Hub Fed.  │   │  - FedContentCard  │ │
│  │  - Sanitize  │   │  - Backfill  │   │  - HubFeed         │ │
│  │             │   │  - Circuit   │   │  - FedHubCard      │ │
│  └──────┬──────┘   └──────┬───────┘   └────────┬───────────┘ │
│         │                 │                     │             │
│         └─────────┬───────┘                     │             │
│                   ▼                             │             │
│          ┌────────────────┐                     │             │
│          │   Schema       │◄────────────────────┘             │
│          │   Package      │                                   │
│          │                │                                   │
│          │  federation.ts │                                   │
│          │  (12 tables)   │                                   │
│          └────────────────┘                                   │
└───────────────────────────────────────────────────────────────┘
```

---

## Database Schema

All federation tables are defined in `packages/schema/src/federation.ts`.

### Table: `remote_actors`

Cached metadata for any remote ActivityPub actor we've interacted with.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| actorUri | text | UNIQUE — canonical AP URI |
| inbox | text | Actor's inbox URL |
| outbox | text | Actor's outbox URL |
| sharedInbox | text | Shared inbox (nullable) |
| publicKeyPem | text | RSA public key for HTTP sig verification |
| preferredUsername | varchar | e.g. "alice" |
| displayName | text | Human-readable name |
| summary | text | Bio/description |
| avatarUrl | text | Profile image |
| bannerUrl | text | Banner image |
| actorType | varchar | Person, Group, Service, Application |
| instanceDomain | varchar | e.g. "mastodon.social" |
| followerCount | int | From AP actor object |
| followingCount | int | From AP actor object |
| lastFetchedAt | timestamp | Cache staleness |
| createdAt | timestamp | |

### Table: `activities`

Queue for all inbound/outbound ActivityPub activities.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| type | varchar | Create, Update, Delete, Follow, Accept, Reject, Undo, Like, Announce |
| actorUri | text | Who initiated the activity |
| objectUri | text | What the activity is about |
| payload | jsonb | Full AP JSON |
| direction | enum | `inbound` or `outbound` |
| status | enum | `pending`, `delivered`, `failed`, `processed`, `dead_lettered` |
| attempts | int | Delivery retry count |
| error | text | Last error message |
| lockedAt | timestamp | Multi-worker lock |
| deadLetteredAt | timestamp | When moved to dead letter |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Indexes**: (direction, status), actorUri, createdAt

### Table: `follow_relationships`

Tracks Follow/Accept/Reject state between actors.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| followerActorUri | text | UNIQUE pair with followingActorUri |
| followingActorUri | text | |
| activityUri | text | The Follow activity URI (for Undo targeting) |
| status | enum | `pending`, `accepted`, `rejected` |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Table: `actor_keypairs`

RSA keypairs for local actors (users). Used for HTTP Signature signing.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| userId | UUID | FK → users |
| publicKeyPem | text | |
| privateKeyPem | text | |
| createdAt | timestamp | |

### Table: `federated_content`

Stores content received from remote instances (via inbox or mirroring).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| objectUri | text | UNIQUE — canonical AP URI on origin |
| actorUri | text | Remote author |
| remoteActorId | UUID | FK → remote_actors (nullable) |
| originDomain | varchar | For filtering and loop prevention |
| apType | varchar | 'Article', 'Note', 'Page' |
| title | text | |
| content | text | Sanitized HTML |
| summary | text | |
| url | text | Canonical link back to origin |
| coverImageUrl | text | |
| tags | jsonb | `[{ type: 'Hashtag', name: '#tag' }]` |
| attachments | jsonb | `[{ type, url, name }]` |
| inReplyTo | text | Parent object URI |
| **cpubType** | **varchar** | **'project', 'blog', 'article', 'explainer' — CommonPub extension** |
| cpubMetadata | jsonb | Custom metadata from CommonPub source |
| cpubBlocks | jsonb | Original BlockTuple[] from source |
| localLikeCount | int | Likes from users on this instance |
| localCommentCount | int | |
| localBoostCount | int | |
| localViewCount | int | |
| publishedAt | timestamp | Original publish date |
| receivedAt | timestamp | When we received it |
| updatedAt | timestamp | |
| deletedAt | timestamp | Soft delete on incoming Delete |
| mirrorId | UUID | FK → instance_mirrors (if via mirror) |
| isHidden | boolean | Admin can hide |

**Indexes**: actorUri, originDomain, receivedAt, apType, cpubType, mirrorId, objectUri

### Table: `federated_content_builds`

"I Built This" marks on federated content from local users.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| federatedContentId | UUID | FK → federated_content |
| userId | UUID | FK → users |
| createdAt | timestamp | |

**Unique**: (userId, federatedContentId)

### Table: `instance_mirrors`

Configuration for instance-level content mirroring.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| remoteDomain | varchar | |
| remoteActorUri | text | |
| status | enum | `pending`, `active`, `paused`, `error` |
| direction | enum | `pull` (we mirror them) or `push` (they mirror us) |
| filterContentTypes | jsonb | Only accept certain types |
| filterTags | jsonb | Only accept certain hashtags |
| contentCount | int | Items received |
| errorCount | int | |
| lastError | text | |
| lastSyncAt | timestamp | |
| pausedAt | timestamp | |
| backfillCursor | text | Resume cursor for outbox backfill |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### Table: `federated_hubs`

Remote hubs we follow as Group actors.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| actorUri | text | UNIQUE — Group actor URI |
| remoteActorId | UUID | FK → remote_actors |
| originDomain | varchar | |
| remoteSlug | varchar | Hub slug on remote |
| name | text | |
| description | text | |
| iconUrl | text | |
| bannerUrl | text | |
| hubType | varchar | community, product, company |
| remoteMemberCount | int | From remote metadata |
| remotePostCount | int | From remote metadata |
| localPostCount | int | Posts received locally |
| status | enum | pending, accepted, rejected |
| followActivityUri | text | For Undo targeting |
| url | text | Canonical URL |
| rules | text | |
| categories | jsonb | |
| isHidden | boolean | |
| lastSyncAt | timestamp | |
| receivedAt | timestamp | |
| updatedAt | timestamp | |

**Indexes**: originDomain, (status, isHidden), name, remoteActorId

### Table: `federated_hub_posts`

Posts received from federated hubs.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| federatedHubId | UUID | FK → federated_hubs |
| objectUri | text | UNIQUE |
| authorUri | text | |
| remoteActorId | UUID | FK → remote_actors |
| content | text | |
| postType | varchar | text, discussion, question, showcase, share |
| isPinned | boolean | |
| localLikeCount | int | |
| localReplyCount | int | |
| remoteLikeCount | int | |
| remoteReplyCount | int | |
| title | text | |
| tags | jsonb | |
| attachments | jsonb | |
| inReplyTo | text | |
| cpubType | varchar | CommonPub type extension |
| cpubMetadata | jsonb | |
| cpubBlocks | jsonb | |
| sharedContentMeta | jsonb | `{ type, title, summary, coverImageUrl, originUrl }` |
| publishedAt | timestamp | |
| receivedAt | timestamp | |
| deletedAt | timestamp | |
| isHidden | boolean | |

### Table: `federated_hub_members`

Known members of federated hubs. Populated from post authors (auto-registered on ingestion) and followers collection fetches.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| federatedHubId | UUID | FK -> federated_hubs |
| remoteActorId | UUID | FK -> remote_actors |
| discoveredVia | varchar(32) | 'post', 'followers', or 'mention' |
| joinedAt | timestamp | When we discovered them |

**Unique**: (federatedHubId, remoteActorId)

### Table: `federated_hub_post_likes`

Local user likes on federated hub posts.

| Column | Type | Notes |
|--------|------|-------|
| postId | UUID | FK → federated_hub_posts |
| userId | UUID | FK → users |
| createdAt | timestamp | |

**Unique**: (postId, userId)

### Table: `instance_health`

Circuit breaker state for delivery to remote instances.

| Column | Type | Notes |
|--------|------|-------|
| domain | varchar | PK |
| consecutiveFailures | int | |
| totalDelivered | int | |
| totalFailed | int | |
| circuitOpenUntil | timestamp | null = circuit closed |
| lastSuccessAt | timestamp | |
| lastFailureAt | timestamp | |

### Auth-Adjacent Tables (in `auth.ts`)

| Table | Purpose |
|-------|---------|
| `federated_accounts` | Links local user to remote actor URI (OAuth SSO) |
| `oauth_clients` | Registered OAuth clients from other instances |
| `oauth_codes` | Short-lived authorization codes for OAuth flow |

---

## Protocol Layer

Package: `@commonpub/protocol` — Pure TypeScript, no database access.

### Files and Responsibilities

| File | Purpose | Key Exports |
|------|---------|-------------|
| `activityTypes.ts` | AP actor/object type definitions | `buildPersonActor()`, `buildGroupActor()`, `buildServiceActor()` |
| `activities.ts` | Activity construction | `buildCreateActivity()`, `buildUpdateActivity()`, `buildDeleteActivity()`, `buildLikeActivity()`, `buildAnnounceActivity()`, `buildUndoActivity()` |
| `actorResolver.ts` | Remote actor fetch + validation | `resolveActor()`, `resolveActorViaWebFinger()` |
| `contentMapper.ts` | Local content → AP Article | `contentToArticle()`, `blockTuplesToHtml()` |
| `inbox.ts` | Inbound activity router | `processInboxActivity()` |
| `outbox.ts` | Outbox collection builder | `generateOutboxCollection()`, `generateOutboxPage()` |
| `sanitize.ts` | HTML sanitization | `sanitizeHtml()` |
| `sign.ts` | HTTP Signature (draft-cavage-12) | `signRequest()` |
| `types.ts` | TypeScript interfaces | `WebFingerResponse`, `NodeInfoResponse`, `ResolvedActor` |
| `webfinger.ts` | WebFinger construction/parsing | `parseWebFingerResource()`, `buildWebFingerResponse()` |
| `nodeinfo.ts` | NodeInfo construction | `buildNodeInfoResponse()`, `buildNodeInfoWellKnown()` |

### Actor Types

| Actor | AP Type | URI Pattern | Purpose |
|-------|---------|-------------|---------|
| User | Person | `https://{domain}/users/{username}` | Individual user identity |
| Hub | Group | `https://{domain}/hubs/{slug}` | Community/product/company |
| Instance | Service | `https://{domain}/actor` | Instance-level actor |

### Content Type Mapping

When federating outbound:

```
Local contentItem.type → AP Article + cpub:type extension
  project   → Article { "cpub:type": "project" }
  article   → Article { "cpub:type": "article" }
  blog      → Article { "cpub:type": "blog" }
  explainer → Article { "cpub:type": "explainer" }
```

When receiving inbound:

```
AP Article + cpub:type → federatedContent.apType + cpubType
  CommonPub source: cpubType preserved (project, article, blog, explainer)
  Non-CommonPub:    cpubType = null, apType = Article/Note
```

---

## Server Layer

Package: `@commonpub/server` — Database operations, business logic.

### Files and Responsibilities

| File | Purpose | Key Functions |
|------|---------|---------------|
| `federation/federation.ts` | Core federation orchestration | `getOrCreateActorKeypair()`, `sendFollow()`, `acceptFollow()`, `rejectFollow()`, `unfollowRemote()`, `federateContent()`, `federateUpdate()`, `federateDelete()`, `federateLike()`, `federateUnlike()` |
| `federation/delivery.ts` | Outbound activity delivery worker | `deliverPendingActivities()` — exponential backoff, HTTP sig signing, circuit breaker |
| `federation/inboxHandlers.ts` | Inbound activity processing | `createInboxHandlers()` → `onFollow`, `onAccept`, `onReject`, `onUndo`, `onCreate`, `onUpdate`, `onDelete`, `onLike`, `onAnnounce` |
| `federation/oauth.ts` | Cross-instance OAuth2 SSO | `processAuthorize()`, `processTokenExchange()`, `processDynamicRegistration()`, `exchangeCodeForToken()`, `createFederatedSession()` |
| `federation/messaging.ts` | Federated DMs | `resolveRemoteHandle()`, `federateDirectMessage()` |
| `federation/timeline.ts` | Federated content queries | `listFederatedTimeline()`, `getFederatedContent()`, `likeRemoteContent()`, `boostRemoteContent()`, `federateReply()` |
| `federation/mirroring.ts` | Instance-level mirroring | `createMirror()`, `pauseMirror()`, `resumeMirror()`, `cancelMirror()` |
| `federation/backfill.ts` | Outbox crawling for history | `backfillFromOutbox()` |
| `federation/hubFederation.ts` | Hub Group actor management | `buildHubGroupActor()`, `handleHubFollow()`, `handleHubUnfollow()`, `federateHubPost()`, `getOrCreateHubKeypair()` |
| `federation/hubMirroring.ts` | Federated hub queries | `listFederatedHubs()`, `refreshFederatedHubMetadata()`, `followRemoteHub()`, `backfillHubFromOutbox()`, `listFederatedHubMembers()`, `listFederatedHubPosts()` |
| `federation/outboxQueries.ts` | Outbox database queries | `countOutboxItems()`, `getOutboxPage()`, `countInstanceOutboxItems()`, `countHubOutboxItems()` |
| `federation/circuitBreaker.ts` | Delivery health tracking | `isCircuitOpen()`, `recordDeliverySuccess()`, `recordDeliveryFailure()` |

---

## API Routes

All routes are in `layers/base/server/` and test-site equivalents.

### Discovery Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/.well-known/webfinger` | GET | Actor discovery (RFC 7033) |
| `/.well-known/nodeinfo` | GET | NodeInfo well-known pointer |
| `/nodeinfo/2.1` | GET | Full NodeInfo response |

### Actor Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/users/{username}` | GET | Person actor (content-negotiated: HTML or AP JSON) |
| `/users/{username}/inbox` | POST | User inbox for receiving activities |
| `/users/{username}/outbox` | GET | User outbox collection |
| `/users/{username}/followers` | GET | Followers collection |
| `/users/{username}/following` | GET | Following collection |
| `/hubs/{slug}` | GET | Group actor (content-negotiated) |
| `/hubs/{slug}/inbox` | POST | Hub inbox |
| `/hubs/{slug}/outbox` | GET | Hub outbox collection |
| `/hubs/{slug}/followers` | GET | Hub followers collection |
| `/actor` | GET | Instance Service actor |
| `/inbox` | POST | Shared inbox for all actors |

### Federation API (internal)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/federation/timeline` | GET | Federated content timeline with filters |
| `/api/federation/content/{id}` | GET | Single federated content item |
| `/api/federation/follow` | POST | Follow a remote actor |
| `/api/federation/unfollow` | POST | Unfollow a remote actor |
| `/api/federation/mirrors` | GET/POST | List/create instance mirrors |
| `/api/federation/mirrors/{id}` | PATCH/DELETE | Update/cancel mirror |

### Federated Hubs API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/federated-hubs` | GET | List accepted federated hubs |
| `/api/federated-hubs/{id}` | GET | Single federated hub detail |
| `/api/federated-hubs/{id}/posts` | GET | Posts in federated hub |
| `/api/federated-hubs/{id}/members` | GET | Members of federated hub |
| `/api/federated-hubs/{id}/feed.xml` | GET | RSS feed for federated hub |

### OAuth2 Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/oauth2/authorize` | GET | OAuth authorization params |
| `/api/auth/oauth2/authorize` | POST | Process consent (generate auth code) |
| `/api/auth/oauth2/token` | POST | Token exchange |
| `/api/auth/oauth2/register` | POST | Dynamic client registration |
| `/api/auth/federated/login` | POST | Initiate federated login |
| `/api/auth/federated/callback` | GET | OAuth callback handler |

### Admin Federation API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/federation/stats` | GET | Delivery stats, circuit breaker status |
| `/api/admin/federation/repair-types` | POST | Re-fetch objects missing cpubType |
| `/api/admin/federation/trusted-instances` | GET/POST/DELETE | Manage trusted instances |

---

## UI Components & Pages

### Pages

| Page | Path | Purpose |
|------|------|---------|
| Fediverse Timeline | `/fediverse` | Browse all federated content |
| Federated Hub | `/federated-hubs/{id}` | View federated hub (posts, members, rules) |
| Federated Hub Post | `/federated-hubs/{id}/posts/{postId}` | Single post in federated hub |
| OAuth Authorize | `/auth/oauth/authorize` | Consent screen for remote instance login |
| Admin Federation | `/admin/federation` | Federation management dashboard |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `FederatedContentCard` | `components/FederatedContentCard.vue` | Renders federated content in timeline; resolves cpubType for icon/label |
| `HubFeed` | `components/hub/HubFeed.vue` | Hub post feed; handles sharedContent cards with type icons |
| `FederatedHubCard` | `components/FederatedHubCard.vue` | Card for federated hub in listings |

### Composables

| Composable | Purpose |
|------------|---------|
| `useMirrorContent` | Resolves content type from cpubType/apType for display |

---

## Content Type Matrix

### How content types flow through federation

```
┌─────────────────┐    Outbound     ┌──────────────────┐    Inbound      ┌──────────────────┐
│  Local Instance  │   Federation    │   Wire Format    │   Processing    │ Remote Instance  │
│                  │                 │   (ActivityPub)  │                 │                  │
│  contentItems    │ ──────────────► │                  │ ──────────────► │ federatedContent │
│  .type =         │                 │  AP Article      │                 │ .apType =        │
│                  │                 │  + cpub:type     │                 │ .cpubType =      │
├─────────────────┤                 ├──────────────────┤                 ├──────────────────┤
│ project          │ ───► Article + cpub:type=project   │ ───► apType=Article, cpubType=project  │
│ article          │ ───► Article + cpub:type=article   │ ───► apType=Article, cpubType=article  │
│ blog             │ ───► Article + cpub:type=blog      │ ───► apType=Article, cpubType=blog     │
│ explainer        │ ───► Article + cpub:type=explainer │ ───► apType=Article, cpubType=explainer│
└─────────────────┘                 └──────────────────┘                 └──────────────────┘
```

### Display Logic

| Source | cpubType | apType | Displayed As |
|--------|----------|--------|--------------|
| CommonPub instance | project | Article | Project card with build icon |
| CommonPub instance | article | Article | Article card |
| CommonPub instance | blog | Article | Blog post card |
| CommonPub instance | explainer | Article | Explainer card |
| Mastodon | null | Note | Generic post |
| Lemmy | null | Article | Generic article |
| Unknown AP server | null | Article | Generic article |

### Content That Does NOT Federate

| Feature | Reason |
|---------|--------|
| Docs (docsSites, docsPages) | Instance-local; versioned site content |
| Learning Paths | Instance-local; enrollment/progress tracking |
| Contests | Instance-local; judging workflow |
| Videos | Instance-local; category management |
| DMs/Messages | Stay on-instance (no E2E encryption yet) |
| Products | Instance-local; associated with local hubs |

---

## Activity Flow Diagrams

### Outbound: Publishing Content

```
1. User publishes contentItem (status → 'published')
2. Server calls federateContent(contentId, domain)
   └─ Check: config.features.federation enabled?
   └─ Fetch content + author from DB
   └─ contentToArticle() → AP Article with cpub:type extension
   └─ blockTuplesToHtml() → Render TipTap blocks to sanitized HTML
   └─ buildCreateActivity() → Wrap in Create activity
   └─ Check for duplicate pending Create (skip if exists)
   └─ INSERT INTO activities (direction=outbound, status=pending)
3. Delivery worker picks up pending activities
   └─ deliverPendingActivities() runs on interval
   └─ Filters by exponential backoff delays
   └─ Claims activity (sets lockedAt)
   └─ Resolves recipient inbox from remote_actors cache
   └─ Looks up sender's keypair (actor_keypairs)
   └─ signRequest() → HTTP Signature (RSA-SHA256)
   └─ POST to recipient inbox
   └─ On success: status → 'delivered', record in instance_health
   └─ On failure: increment attempts, record error
   └─ After max retries: status → 'dead_lettered'
```

### Inbound: Receiving Content

```
1. Remote instance POSTs to /inbox (shared) or /users/{username}/inbox
2. Parse activity JSON
3. processInboxActivity() routes to handler:
   └─ onCreate():
      └─ Resolve remote actor → cache in remote_actors
      └─ Sanitize HTML content
      └─ Extract cpub:type extension if present
      └─ INSERT INTO federated_content
      └─ Update mirror contentCount if via mirror
   └─ onUpdate():
      └─ Find existing federatedContent by objectUri
      └─ Update content, title, etc.
   └─ onDelete():
      └─ Soft-delete: SET deletedAt = NOW()
   └─ onLike():
      └─ Increment localLikeCount on target
   └─ onAnnounce():
      └─ If from Group actor → store in federated_hub_posts
```

### Follow Flow

```
Outbound Follow:
  1. sendFollow(userId, remoteActorUri, domain)
  2. Resolve remote actor (fetch + cache)
  3. INSERT follow_relationships (status=pending)
  4. Build Follow activity
  5. INSERT activities (direction=outbound, status=pending)
  6. Delivery worker sends to remote inbox
  7. Remote responds with Accept/Reject
  8. onAccept() → UPDATE follow_relationships status=accepted
  9. Optionally trigger backfill of remote outbox

Inbound Follow:
  1. Remote POSTs Follow to our inbox
  2. onFollow() → resolve remote actor, cache
  3. UPSERT follow_relationships
  4. Auto-accept (if configured)
  5. Build Accept activity → queue for delivery
  6. Create notification for local user
```

---

## OAuth SSO Flow

```
Instance A (user's home)          Instance B (remote)
─────────────────────             ─────────────────────

1. User clicks "Login with Instance B"
   └─ POST /api/auth/federated/login
      { instanceDomain: "instance-b.io" }

2. Server discovers OAuth endpoint:
   └─ WebFinger: instance@instance-b.io
   └─ Extract oauth_endpoint from links

3. Server stores state token (storeOAuthState)
   └─ Returns: { authorizationUrl, state }

4. Client redirects to Instance B:
   GET https://instance-b.io/auth/oauth/authorize
     ?client_id=cpub_instance-a.io
     &redirect_uri=https://instance-a.io/api/auth/federated/callback
     &response_type=code
     &state={token}

5. Instance B shows consent screen          ◄── BUG: middleware: 'auth'
   └─ User must be logged in on B              requires pre-authentication
   └─ Shows: "Instance A requests access"
   └─ User clicks Approve

6. Instance B generates auth code:
   POST /api/auth/oauth2/authorize
   └─ Returns redirect to Instance A with ?code=...

7. Instance A callback:
   GET /api/auth/federated/callback?code={code}&state={state}
   └─ Verify state token
   └─ exchangeCodeForToken(code, ...)
   └─ POST to Instance B: /api/auth/oauth2/token
   └─ Get access token + user info
   └─ createFederatedSession() → local session

8. User is now logged in on Instance A
   └─ federated_accounts links local user ↔ remote actorUri
```

**Database tables involved**: oauth_clients, oauth_codes, federated_accounts, sessions

---

## Hub Federation

### Hub Actor Lifecycle

```
Local Hub Creation:
  1. Hub created in hubs table
  2. If config.features.federateHubs:
     └─ getOrCreateHubKeypair(hubId) → RSA keypair stored
     └─ Hub becomes addressable as Group actor at /hubs/{slug}

Remote Hub Follow:
  1. Admin discovers remote hub by actorUri
  2. followRemoteHub(hubId, domain):
     └─ Resolve Group actor → cache in remote_actors
     └─ INSERT federated_hubs (status=pending)
     └─ Build Follow activity from instance actor
     └─ Queue for delivery
  3. Remote accepts → status=accepted
  4. Begin receiving Announce activities for hub posts

Hub Post Distribution:
  1. User creates post in local hub
  2. federateHubPost(hubId, postId, domain):
     └─ Build Announce activity from hub Group actor
     └─ Send to hub followers
  3. Remote instances receive → store in federated_hub_posts
```

### Hub Metadata Sync

```
refreshFederatedHubMetadata(hubId, actorUri):
  1. Check: lastSyncAt older than 1 hour?
  2. Fetch remote Group actor JSON
  3. Update: name, description, iconUrl, bannerUrl, memberCount, postCount
  4. Update: lastSyncAt = NOW()

Hub Sync Plugin (if config.features.federateHubs):
  - Runs on configurable interval (hubSyncIntervalMs)
  - Iterates all accepted federated hubs
  - Refreshes stale metadata
```

### Hub Members

Members are tracked via the `federated_hub_members` table, populated from:
- **Post ingestion**: Authors auto-registered when posts arrive
- **Followers collection fetch**: Run on first hub sync and via admin backfill
- **Fallback**: For pre-migration hubs, derives members from post authors

`listFederatedHubMembers()` queries from the members table with LEFT JOIN post counts.

---

## Instance Mirroring

```
Pull Mirror (we mirror them):
  1. Admin creates mirror: createMirror(remoteDomain, ...)
  2. Follow remote instance actor
  3. Receive content via inbox (filtered by mirror config)
  4. Optional: backfillFromOutbox() for historical content

Push Mirror (they mirror us):
  1. Remote instance follows our instance actor
  2. We deliver content to their inbox
  3. No local config needed (handled by follow)

Backfill:
  1. backfillFromOutbox(remoteActorUri, domain, maxItems)
  2. Fetch outbox OrderedCollection
  3. Page through items (max 50 pages, 1s delay)
  4. Process Create/Update/Announce activities
  5. Store cursor for crash resume
```

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| **Transport** | HTTP Signatures (RSA-SHA256, draft-cavage-12) on all outbound POSTs |
| **Content** | HTML sanitization — strip scripts, event handlers, javascript: URLs |
| **Network** | SSRF protection — block private IPs, loopback, metadata services in actor resolution and image proxy |
| **Delivery** | Exponential backoff (1m → 5m → 30m → 2h → 12h → 48h) |
| **Health** | Circuit breaker — stop delivery after 50 consecutive failures; escalating cooldown (5m → 15m → 1h → 6h → 24h) |
| **Concurrency** | Activity locking (lockedAt) prevents duplicate delivery in multi-worker |
| **Dead Letter** | Failed activities moved to dead_lettered after max retries |
| **Auth** | OAuth2 with state tokens, client registration, short-lived auth codes |
| **Trust** | Trusted instances list — only allow OAuth from approved domains |

### Missing Security (TODO)

- **HTTP Signature verification on inbox routes** — inbound activities are not verified against sender's public key (P0)
- Redis authentication in production docker-compose

---

## Feature Flags

| Flag | Config Path | Purpose |
|------|-------------|---------|
| `federation` | `config.features.federation` | Master switch for all federation |
| `federateHubs` | `config.features.federateHubs` | Enable hub Group actor federation |
| `seamlessFederation` | `config.features.seamlessFederation` | Cross-instance content delivery |
| `emailNotifications` | `config.features.emailNotifications` | Email digests for federated activity |

All flags checked via `requireFeature()` guard in API routes.

---

## Known Issues

### Critical

1. **HTTP Signature verification not implemented on inbox** — Inbound activities are accepted without verifying the sender's public key. Any actor can spoof activities.

### Fixed (Session 104)

- ~~OAuth authorize page~~ — **FIXED**: Inline login + consent, no middleware
- ~~Hub members list empty~~ — **FIXED**: `federated_hub_members` table, auto-populate, fallback
- ~~Projects lumped with discussions~~ — **FIXED**: `sharedContentPosts` filter checks type, discussion filter excludes shares
- ~~Share posts show as JSON~~ — **FIXED**: `hubPostToNote` generates readable content + `cpub:sharedContent` for share posts
- ~~Hub post HTML shown as text~~ — **FIXED**: FeedItem strips HTML for preview, post detail uses v-html
- ~~onUpdate auth bypass~~ — **FIXED**: Checks content existence before fallback to onCreate

### Medium

2. **Article type ambiguity** — Non-CommonPub federated content with `apType=Article` and no `cpubType` renders as generic article. Low impact — admin repair-types tool exists.

6. **refreshFederatedHubMetadata silently swallows all errors** — Bare `catch {}` hides federation sync failures.

7. **Backfill.ts uses unsigned fetches** — Instance-level backfill doesn't sign HTTP requests, which may fail on instances that require signatures for outbox access.

### Low

8. **Hub sync plugin no duplicate prevention** — If server restarts during sync interval, may double-sync.
9. **`as any` casts in upload-from-url** — Storage adapter type limitation in `infra/src/files/upload-from-url.post.ts`.
