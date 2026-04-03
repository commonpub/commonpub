# CommonPub Full Federation Plan

> Written 2026-03-20. Supersedes the F1–F8 roadmap in `docs/reference/guides/federation.md`.
> Based on: full codebase audit, archived session 008, ADR 019, Fedify 2.0 docs, W3C ActivityPub spec, Lemmy/PeerTube/Mastodon/BookWyrm/Funkwhale/Misskey federation implementations, FEP-1b12/400e/8b32/044f, and content mirroring research.

---

## The Vision

CommonPub is not federating status updates. It's federating **structured maker content** — projects with bills of materials, products with specs, learning paths with progress, documentation with versions, and communities (hubs) with moderation. No one in the fediverse does this today. That's the opportunity.

**The killer feature**: A maker on `hack.build` publishes a project using an Arduino Nano. That project automatically appears in the Arduino Nano product gallery on `circuits.community` — because both instances federate products and BOMs. A learner on `learn.electronics` enrolls in a learning path that includes content from three different instances. A company hub on `acme.dev` has members from five instances, all participating in the same discussion feed with consistent moderation.

This is **content-type-aware federation** — not just forwarding JSON blobs, but understanding what the content *is* and rendering it natively on the receiving instance.

---

## Design Principles

1. **Graceful degradation** — Every CommonPub object MUST render as a standard AP Article/Note on non-CommonPub servers (Mastodon sees a readable article). CommonPub-to-CommonPub gets the rich experience.
2. **Origin authority** — Content has one canonical origin. Other instances cache/mirror it. Edits propagate from origin. Deletion is advisory but respected.
3. **Selective by default** — Admins choose what to federate: per content type, per hub, per user. Not all-or-nothing.
4. **Local-first** — Federation never blocks local operations. All federation is async via queue. If delivery fails, local state is correct and retries happen in background.
5. **Hub sovereignty** — Hub moderators control their space regardless of where members come from. Remote members can be banned. Remote content can be rejected.
6. **Namespace extensions, not forks** — Use `https://commonpub.org/ns/v1#` for custom properties. Never break AS2 compatibility. Always include standard fallback types.

---

## Current State (v1 — What Exists Today)

| Component | Status | Notes |
|-----------|--------|-------|
| Actor profiles (Person) | ✅ | JSON-LD with public keys, WebFinger, NodeInfo |
| Follow lifecycle | ✅ | Follow/Accept/Reject/Undo — full implementation |
| Activity logging | ✅ | 9 activity types logged to `activities` table |
| Content mapping | ✅ | `contentToArticle()`, `contentToNote()` + reverse mappers |
| Remote actor cache | ✅ | `remoteActors` table with 24h TTL |
| OAuth2 SSO (provider) | ✅ | Model B — authorize + token endpoints |
| HTTP Signature verification | ✅ | Inbound verification works |
| HTTP Signature signing | ✅ | Outbound signed (draft-cavage-12, `signRequest()`) |
| Activity delivery | ✅ | Outbound hooks wired: publish, update, delete, like, unlike (sessions 074-080) |
| Inbound content persistence | ✅ | `federatedContent` table, sanitized HTML, loop prevention (session 076) |
| Hub federation (Group) | ✅ | FEP-1b12 Group actors, follow lifecycle, Announce (session 083) |
| Content mirroring | ✅ | Instance mirrors with type/tag filters (session 079) |
| Cross-instance interaction | ✅ | Like, boost, reply on remote content (sessions 076-077) |
| CommonPub namespace | ✅ | `cpub:type` and `cpub:metadata` extracted and stored (session 076) |
| Selective federation config | ✅ | Mirror-level content type + tag filters (session 079) |
| OAuth2 SSO (consumer) | ✅ | Authorize + token + federated login flow (session 078) |
| Federated search | ✅ | ILIKE search on federatedContent (session 080) |
| Federated timeline | ✅ | Paginated, filtered, with actor info (session 076) |

### Known Limitations (v1 — to fix in v2)

| # | Limitation | Status | Notes |
|---|-----------|--------|-------|
| L1 | Follow Undo ambiguity | ✅ FIXED (session 082) | `activityUri` column + exact match in onUndo |
| L2 | OAuth callback | ✅ FIXED (session 082) | State storage + token exchange + account linking |
| L3 | Federated search uses ILIKE | Deferred v2 | Needs Meilisearch adapter |
| L4 | Concurrent delivery workers | ✅ DOCUMENTED | Single worker; FOR UPDATE SKIP LOCKED for scale |
| L5 | Like count not decremented | ✅ FIXED (session 082) | GREATEST(count - 1, 0) on Undo(Like) |
| L6 | Hub federation (Group) | ✅ FIXED (session 083) | FEP-1b12 Group actors, follow lifecycle, Announce |
| L7 | Dynamic OAuth client registration | ✅ FIXED (session 083) | Public registration endpoint, validation, idempotent |
| L8 | Instance actor route | ✅ FIXED (session 082) | GET /actor + WebFinger support |

---

## Phase Architecture

10 phases, each independently shippable. Phases 1–4 are foundational. Phases 5–8 are the differentiators. Phases 9–10 are advanced.

```
Phase 1: Outbound Delivery (make activities actually arrive)
Phase 2: Inbound Persistence (store remote content locally)
Phase 3: Cross-Instance Interaction (like/comment on remote content)
Phase 4: OAuth2 Consumer (complete SSO both directions)
Phase 5: CommonPub Namespace (rich content types over AP)
Phase 6: Hub Federation (Group actors with FEP-1b12)
Phase 7: Content Mirroring (instance-level content sync)
Phase 8: BOM Federation (cross-instance product galleries)
Phase 9: Selective Federation (granular admin controls)
Phase 10: Relay & Discovery (topic-aware content distribution)
```

---

## Phase 1: Outbound Delivery

**Goal**: Activities logged in the `activities` table actually arrive at remote inboxes.

**Why first**: Nothing else works without this. Currently activities are logged with status `'pending'` and never delivered.

### Schema Changes

```sql
-- Add delivery tracking columns to activities table
ALTER TABLE activities ADD COLUMN target_inbox text;
ALTER TABLE activities ADD COLUMN last_attempt_at timestamptz;
ALTER TABLE activities ADD COLUMN next_retry_at timestamptz;
```

### Implementation

1. **HTTP Signature signing** (`packages/protocol/src/keypairs.ts`)
   - `signRequest(request, privateKeyPem, keyId)` — Signs `(request-target)`, `host`, `date`, `digest` headers
   - Use draft-cavage-http-signatures-12 (de facto standard) with RSA-SHA256
   - Also support RFC 9421 via double-knocking (try draft-cavage first, fall back to RFC 9421 if rejected)

2. **Activity delivery** (`packages/server/src/federation/delivery.ts`)
   - `deliverActivity(db, activityId)` — Fetch activity from DB, resolve target inbox, sign request, POST
   - `resolveTargetInboxes(db, actorUri, activity)` — For public activities: all followers' inboxes (prefer sharedInbox). For targeted: specific actor inbox.
   - `processDeliveryQueue(db)` — Pick pending activities, deliver with exponential backoff (1m, 5m, 30m, 2h, 12h, 48h), max 6 attempts
   - Mark delivered activities as `'delivered'`, failed as `'failed'` with error message

3. **Queue integration** — Use Fedify 2.0's `PostgresMessageQueue` from `@fedify/postgres` (same PG instance, no extra infra). Dev mode uses `InProcessMessageQueue`.

4. **Shared inbox optimization** — When delivering to multiple followers on the same instance, deliver once to their shared inbox.

### Fedify 2.0 Integration

Replace hand-rolled delivery with Fedify's `Context.sendActivity()`:
```typescript
// In federation hook:
await ctx.sendActivity(
  { identifier: author.username },
  "followers",
  createActivity,
  { preferSharedInbox: true }
);
```

Fedify handles: signing, delivery, retry, shared inbox dedup, fan-out.

### Tests

- Unit: `signRequest()` produces valid HTTP Signatures
- Integration: Activity delivery to mock inbox, retry on failure, shared inbox dedup
- Interop: Record + replay against Mastodon/Lemmy inbox expectations

### Feature Flag

`federation` must be `true`. No new flag needed — delivery is the natural completion of the existing federation feature.

### Estimated Effort: Medium

---

## Phase 2: Inbound Persistence

**Goal**: When a remote instance sends us a Create/Update/Delete activity, we actually store the content locally so users can see it in their feeds.

### Schema Changes

```sql
CREATE TABLE federated_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Origin tracking
  object_uri text NOT NULL UNIQUE,
  actor_uri text NOT NULL,
  origin_domain varchar(255) NOT NULL,
  -- Content (cached)
  ap_type varchar(32) NOT NULL, -- 'Article', 'Note', 'Page', etc.
  title text,
  content text, -- sanitized HTML
  summary text,
  url text, -- canonical URL on origin
  published_at timestamptz,
  updated_at timestamptz,
  -- Media
  cover_image_url text,
  attachments jsonb DEFAULT '[]',
  tags jsonb DEFAULT '[]',
  -- CommonPub extensions (populated for cpub-to-cpub)
  cpub_type varchar(32), -- 'project', 'article', 'blog', 'explainer'
  cpub_metadata jsonb, -- BOM, specs, learning data, etc.
  -- Engagement (local)
  local_like_count int DEFAULT 0,
  local_comment_count int DEFAULT 0,
  -- Timestamps
  fetched_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz -- soft delete for Tombstone/Delete
);

CREATE INDEX idx_fedcontent_actor ON federated_content(actor_uri);
CREATE INDEX idx_fedcontent_domain ON federated_content(origin_domain);
CREATE INDEX idx_fedcontent_published ON federated_content(published_at DESC);
CREATE INDEX idx_fedcontent_type ON federated_content(ap_type);
CREATE INDEX idx_fedcontent_cpub_type ON federated_content(cpub_type);
```

### Implementation

1. **Inbox handlers** — Update stub callbacks in `packages/protocol/src/inbox.ts`:
   - `onCreate`: Parse Article/Note → sanitize HTML (DOMPurify) → insert into `federated_content`
   - `onUpdate`: Find by `object_uri` → update content, set `updated_at`
   - `onDelete`: Find by `object_uri` → set `deleted_at` (soft delete)
   - `onLike`: Increment `local_like_count` on target content (if local)
   - `onAnnounce`: Store as a boost reference

2. **HTML sanitization** — Critical security boundary. Strip `<script>`, `<iframe>`, `<object>`, `<embed>`, event handlers. Allow: `<p>`, `<a>`, `<img>`, `<h1>`–`<h6>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<code>`, `<pre>`, `<em>`, `<strong>`, `<br>`. Sanitize URLs (no `javascript:`, `data:` with executable MIME types).

3. **Federated feed** (`packages/server/src/federation/feed.ts`):
   - `listFederatedFeed(db, userId, opts)` — Content from followed remote actors, paginated, sorted by `published_at`
   - `listFederatedFeedByDomain(db, domain, opts)` — Content from a specific instance
   - `getFederatedContent(db, objectUri)` — Single item by URI

4. **Content type detection** — When receiving from another CommonPub instance, check for `cpub:type` in the JSON-LD context. If present, extract CommonPub-specific metadata into `cpub_metadata`.

### API Endpoints

- `GET /api/feed/federated` — Federated feed (content from followed remote users)
- `GET /api/feed/federated/[domain]` — Content from a specific instance
- `GET /api/federated/[encodedUri]` — Single federated content item

### Tests

- Inbound Create → content persisted with correct fields
- Inbound Update → content updated, old version preserved
- Inbound Delete → soft delete via `deleted_at`
- HTML sanitization: XSS payloads stripped, safe HTML preserved
- CommonPub namespace detection: `cpub:type` extracted when present

### Estimated Effort: Medium

---

## Phase 3: Cross-Instance Interaction

**Goal**: Users can like, comment on, and bookmark federated content.

### Schema Changes

```sql
-- Add remote tracking to existing tables
ALTER TABLE likes ADD COLUMN remote_object_uri text;
ALTER TABLE comments ADD COLUMN remote_object_uri text;
ALTER TABLE comments ADD COLUMN remote_actor_uri text;
ALTER TABLE bookmarks ADD COLUMN remote_object_uri text;
```

### Implementation

1. **Like remote content** — `likeRemoteContent(db, userId, objectUri)`:
   - Insert local like with `remote_object_uri`
   - Build Like activity → deliver to object's actor inbox
   - Increment `local_like_count` on `federated_content` row

2. **Comment on remote content** — `commentOnRemoteContent(db, userId, objectUri, content)`:
   - Insert local comment with `remote_object_uri` and `inReplyTo` set to the federated object URI
   - Build Create(Note) activity with `inReplyTo` → deliver to object's actor inbox
   - Increment `local_comment_count`

3. **Receive remote interactions** — Update inbox handlers:
   - `onLike` for local content: increment like count, create notification
   - `onCreate` with `inReplyTo` pointing to local content: persist as comment, create notification

4. **Bookmark remote content** — Local-only operation, no federation needed

### API Endpoints

- `POST /api/federated/[encodedUri]/like` — Like federated content
- `POST /api/federated/[encodedUri]/comment` — Comment on federated content
- `POST /api/federated/[encodedUri]/bookmark` — Bookmark federated content
- `DELETE /api/federated/[encodedUri]/like` — Unlike (sends Undo(Like))

### Estimated Effort: Medium

---

## Phase 4: OAuth2 Consumer

**Goal**: Complete the SSO flow so users can log in to Instance B using their Instance A credentials (consumer side).

### Implementation

Currently only the provider side exists (authorize + token endpoints on Instance A). Need the consumer side on Instance B.

1. **OAuth2 callback handler** — `GET /auth/callback/[instance]`:
   - Exchange authorization code for access token
   - Fetch user info from token endpoint
   - Create or link `federatedAccounts` row
   - Create session

2. **Login UI** — "Login with [Instance]" button on sign-in page when `trustedInstances` is configured

3. **Token refresh** — Background refresh of OAuth2 tokens before expiry

4. **Dynamic client registration** — Optional: auto-register OAuth clients between CommonPub instances using WebFinger discovery (no manual setup).

### Estimated Effort: Small

---

## Phase 5: CommonPub Namespace

**Goal**: Define rich AP object types for all CommonPub content types. CommonPub-to-CommonPub instances get full fidelity. Non-CommonPub servers see standard Article/Note.

**This is where CommonPub becomes something nobody else has.**

### The Namespace

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1",
    {
      "cpub": "https://commonpub.org/ns/v1#",
      "cpub:type": { "@id": "cpub:type", "@type": "@id" },
      "cpub:specs": { "@id": "cpub:specs" },
      "cpub:bom": { "@id": "cpub:bom" },
      "cpub:hubType": { "@id": "cpub:hubType" },
      "cpub:difficulty": { "@id": "cpub:difficulty" },
      "cpub:learningPath": { "@id": "cpub:learningPath" },
      "cpub:version": { "@id": "cpub:version" },
      "cpub:productCategory": { "@id": "cpub:productCategory" },
      "cpub:purchaseUrl": { "@id": "cpub:purchaseUrl" },
      "cpub:datasheetUrl": { "@id": "cpub:datasheetUrl" }
    }
  ]
}
```

### Content Type Mappings

| CommonPub Type | AP Type (standard) | CommonPub Extension | Graceful Degradation |
|---------------|-------------------|--------------------|--------------------|
| project | Article | `cpub:type: "project"`, `cpub:bom`, `cpub:difficulty` | Full article with BOM in body text |
| article | Article | `cpub:type: "article"` | Standard Article |
| blog | Article | `cpub:type: "blog"` | Standard Article |
| explainer | Article | `cpub:type: "explainer"`, `cpub:sections` | Article with sections as headings |
| product | Document | `cpub:type: "product"`, `cpub:specs`, `cpub:purchaseUrl` | Document with specs in body |
| hub (community) | Group | `cpub:hubType: "community"` | Standard Group (Lemmy-compatible) |
| hub (product) | Group | `cpub:hubType: "product"` | Standard Group |
| hub (company) | Organization | `cpub:hubType: "company"` | Standard Organization |
| learning path | Collection | `cpub:type: "learningPath"`, `cpub:modules` | OrderedCollection of Articles |
| doc site | Collection | `cpub:type: "docSite"`, `cpub:version` | OrderedCollection of Articles |
| comment | Note | (standard) | Standard Note |
| hub post | Note | `cpub:hubPost: true`, `audience` | Note with audience (Lemmy-compatible) |

### Example: Project with BOM

```json
{
  "@context": ["https://www.w3.org/ns/activitystreams", "...cpub context..."],
  "type": ["Article"],
  "id": "https://hack.build/content/robot-arm",
  "attributedTo": "https://hack.build/users/alice",
  "name": "Building a 6-DOF Robot Arm",
  "content": "<article>Full HTML content...</article>",
  "summary": "A detailed guide to building a desktop robot arm",
  "published": "2026-03-10T00:00:00Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://hack.build/users/alice/followers"],
  "attachment": [
    { "type": "Image", "url": "https://hack.build/files/robot-cover.webp", "name": "Cover" }
  ],
  "tag": [
    { "type": "Hashtag", "name": "#robotics" },
    { "type": "Hashtag", "name": "#arduino" }
  ],
  "cpub:type": "project",
  "cpub:difficulty": "intermediate",
  "cpub:bom": [
    {
      "name": "Arduino Nano",
      "quantity": 1,
      "role": "controller",
      "productUri": "https://circuits.community/products/arduino-nano",
      "required": true
    },
    {
      "name": "MG996R Servo",
      "quantity": 6,
      "role": "actuator",
      "required": true
    }
  ]
}
```

**What Mastodon sees**: A standard Article with title "Building a 6-DOF Robot Arm", full HTML body, cover image, and hashtags. Perfectly readable.

**What another CommonPub instance sees**: All of the above PLUS the BOM with product links, difficulty level, and content type. Can render the rich project view with parts list and product gallery links.

### Example: Product

```json
{
  "@context": ["https://www.w3.org/ns/activitystreams", "...cpub context..."],
  "type": ["Document"],
  "id": "https://circuits.community/products/arduino-nano",
  "attributedTo": "https://circuits.community/hubs/arduino",
  "name": "Arduino Nano",
  "content": "<p>The Arduino Nano is a small, complete, and breadboard-friendly board...</p>",
  "url": "https://circuits.community/products/arduino-nano",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cpub:type": "product",
  "cpub:productCategory": "microcontroller",
  "cpub:specs": {
    "processor": "ATmega328P",
    "clock": "16 MHz",
    "flash": "32 KB",
    "sram": "2 KB",
    "digitalIO": 22,
    "analogInput": 8,
    "voltage": "5V"
  },
  "cpub:purchaseUrl": "https://store.arduino.cc/nano",
  "cpub:datasheetUrl": "https://docs.arduino.cc/hardware/nano"
}
```

### Implementation

1. **Extended content mapper** (`packages/protocol/src/contentMapper.ts`):
   - `contentToAPObject(item, author, domain, options)` — Generates AP object with CommonPub namespace extensions
   - `apObjectToContent(object)` — Parses incoming AP objects, extracts CommonPub metadata if present
   - `isCommonPubObject(object)` — Checks for `cpub:type` in context

2. **Namespace registry** (`packages/protocol/src/namespace.ts`):
   - `COMMONPUB_CONTEXT` — The JSON-LD context definition
   - `buildContext(types)` — Build context array with only needed extensions
   - Type guards for each cpub type

3. **Product mapper** — `productToDocument(product, hub, domain)` / `documentToProduct(doc)`

4. **Learning path mapper** — `learningPathToCollection(path, modules, domain)` / `collectionToLearningPath(collection)`

### Tests

- Round-trip: content → AP object → content (lossless for cpub-to-cpub)
- Degradation: AP object renders correctly on non-CommonPub server
- Detection: `isCommonPubObject()` correctly identifies cpub objects

### Estimated Effort: Medium

---

## Phase 6: Hub Federation (Groups)

**Goal**: Hubs become AP Group actors. Users on remote instances can join hubs, post in them, and see the feed. Moderation works cross-instance.

**This is the hardest phase and the most valuable.** This is what Lemmy does for link aggregation, but for structured maker content.

### How It Works (FEP-1b12 Announce Pattern)

```
User on Instance B follows Hub on Instance A
  → Follow activity → Hub inbox on A
  → Hub auto-accepts (or requires approval for private hubs)
  → Accept activity → User inbox on B

User on Instance B creates a post in Hub on Instance A
  → Create(Note) with audience: Hub URI → Hub inbox on A
  → Hub validates: is user a member? is content acceptable?
  → Hub wraps in Announce → delivers to ALL hub followers (including Instance B)
  → All instances store the post locally
```

**Key insight from Lemmy**: The hub (Group) actor is the distribution hub. ALL content posted to the hub is wrapped in `Announce` and sent to all followers. This means:
- Every instance that has followers in the hub gets all content
- The hub's instance is the authority for what content is accepted
- Remote instances display the content as if it were local

### Actor Types

```json
// Hub as Group actor
{
  "@context": ["https://www.w3.org/ns/activitystreams", "...cpub context..."],
  "type": "Group",
  "id": "https://hack.build/hubs/robotics",
  "preferredUsername": "robotics",
  "name": "Robotics Community",
  "summary": "A community for robotics enthusiasts",
  "inbox": "https://hack.build/hubs/robotics/inbox",
  "outbox": "https://hack.build/hubs/robotics/outbox",
  "followers": "https://hack.build/hubs/robotics/followers",
  "url": "https://hack.build/hub/robotics",
  "publicKey": { "...": "..." },
  "endpoints": { "sharedInbox": "https://hack.build/inbox" },
  "attributedTo": ["https://hack.build/users/alice"],
  "cpub:hubType": "community",
  "cpub:joinPolicy": "open"
}
```

### Schema Changes

```sql
-- Hub federation endpoints
ALTER TABLE hubs ADD COLUMN ap_inbox text;
ALTER TABLE hubs ADD COLUMN ap_outbox text;
ALTER TABLE hubs ADD COLUMN ap_followers text;

-- Remote hub members
CREATE TABLE remote_hub_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  actor_uri text NOT NULL,
  role varchar(16) DEFAULT 'member' NOT NULL, -- member, moderator
  status varchar(16) DEFAULT 'pending' NOT NULL, -- pending, active, banned
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(hub_id, actor_uri)
);

-- Remote hubs we're following (hubs hosted elsewhere)
CREATE TABLE followed_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_uri text NOT NULL UNIQUE,
  origin_domain varchar(255) NOT NULL,
  name text,
  summary text,
  avatar_url text,
  hub_type varchar(16), -- community, product, company
  join_policy varchar(16),
  local_follower_count int DEFAULT 0,
  last_fetched_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Content posted to federated hubs (both local and remote)
CREATE TABLE hub_federated_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid REFERENCES hubs(id) ON DELETE CASCADE, -- NULL if hub is remote
  hub_uri text NOT NULL, -- URI of the hub (local or remote)
  object_uri text NOT NULL,
  actor_uri text NOT NULL,
  content text,
  ap_type varchar(32) NOT NULL,
  announced_at timestamptz, -- when the hub Announced it
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  UNIQUE(hub_uri, object_uri)
);
```

### Implementation

1. **Hub actor dispatcher** — Register hubs as Group actors with Fedify:
   - WebFinger: `@robotics@hack.build` resolves to hub Group actor
   - Actor document: Group with inbox/outbox/followers
   - Keypair: Per-hub keypair (separate from user keypairs)

2. **Hub inbox handlers**:
   - `Follow` → Add to `remote_hub_members` (auto-accept for open, pending for approval/invite)
   - `Undo(Follow)` → Remove from `remote_hub_members`
   - `Create(Note/Article)` → Validate membership → Store post → Announce to all followers
   - `Update` → Update existing post → re-Announce
   - `Delete` → Soft delete post → Announce(Delete)
   - `Like` → Process like on hub post

3. **Hub announce pipeline** — When content is posted to a hub (locally or remotely):
   ```
   Content arrives at hub inbox
   → Validate: is actor a member? is content allowed? moderation rules?
   → Store in hub_federated_posts
   → Build Announce activity (hub as actor, original Create as object)
   → Deliver to ALL hub followers
   ```

4. **Moderation activities**:
   - `Block(actor)` → Ban remote user from hub
   - `Remove(actor)` → Kick remote member
   - `Add(actor, moderators)` → Promote to moderator
   - `Remove(actor, moderators)` → Demote from moderator
   - All wrapped in `Announce` for distribution

5. **Hub following** (from remote) — When a user on Instance B follows a hub on Instance A:
   - Instance B discovers hub via WebFinger
   - Sends Follow to hub inbox
   - Hub accepts → Instance B creates `followed_hubs` entry
   - Hub's Announce activities arrive at Instance B's shared inbox
   - Instance B stores posts in `hub_federated_posts`

### Hub Types & Federation Behavior

| Hub Type | AP Actor Type | Federation Behavior |
|----------|--------------|-------------------|
| community | Group | Full FEP-1b12: members post, hub Announces |
| product | Group | Read-mostly: owner publishes, followers receive. Members can share projects. |
| company | Organization | Read-only: company publishes products/updates, followers receive |

### API Endpoints

- `GET /hubs/[slug]` — Content negotiation: HTML for browsers, Group actor for AP
- `POST /hubs/[slug]/inbox` — Hub inbox
- `GET /hubs/[slug]/outbox` — Hub outbox (paginated Announce collection)
- `GET /hubs/[slug]/followers` — Hub followers collection
- `POST /api/federation/hub/follow` — Follow a remote hub
- `DELETE /api/federation/hub/follow/[id]` — Unfollow remote hub
- `GET /api/federation/hubs` — List followed remote hubs

### Tests

- Hub actor document is valid Group
- WebFinger resolves hub
- Follow → Accept lifecycle
- Post → Announce → delivery to followers
- Remote post → hub validates membership → Announce
- Moderation: ban remote user → they can't post
- Join policy enforcement: open vs approval vs invite

### Estimated Effort: Large

---

## Phase 7: Content Mirroring

**Goal**: Instance B can mirror all public content from Instance A. New content appears automatically. Media is optionally cached locally.

### How It Works

Mirroring is built on top of Phases 1–3 (delivery + persistence). Two modes:

**Follow-based mirroring** (default): Instance B follows specific users/hubs on Instance A. Content arrives via normal AP delivery and is stored in `federated_content`. This is what Phases 1–3 already enable.

**Full instance mirroring** (admin opt-in): Instance B subscribes to Instance A's full public feed. All public content is synced. This requires a dedicated sync mechanism beyond individual follows.

### Full Mirror Architecture

```
Admin on Instance B → "Mirror hack.build"
  → Instance B follows Instance A's "instance actor" (Application type)
  → Instance A's instance actor Announces all public content
  → Instance B receives and stores everything

Initial sync:
  → Instance B paginates Instance A's outbox collection
  → Stores all historical public content in federated_content
  → Optionally caches media locally

Ongoing:
  → New content delivered via AP (Create/Update/Delete)
  → Instance B processes and stores
```

### Schema Changes

```sql
CREATE TABLE instance_mirrors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source instance
  source_domain varchar(255) NOT NULL UNIQUE,
  source_actor_uri text NOT NULL, -- Instance actor URI
  -- Mirror config
  mirror_mode varchar(16) DEFAULT 'follow' NOT NULL, -- 'follow' | 'full'
  content_types jsonb DEFAULT '["article", "project", "blog"]', -- which cpub types to mirror
  cache_media boolean DEFAULT false,
  media_budget_mb int DEFAULT 5000, -- max media cache size
  -- Sync state
  status varchar(16) DEFAULT 'active' NOT NULL, -- active, paused, error
  last_sync_at timestamptz,
  items_synced int DEFAULT 0,
  sync_cursor text, -- pagination cursor for initial sync
  error text,
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE media_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_url text NOT NULL UNIQUE,
  local_path text NOT NULL,
  mime_type varchar(128),
  size_bytes bigint,
  origin_domain varchar(255) NOT NULL,
  fetched_at timestamptz DEFAULT now() NOT NULL,
  last_accessed_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz -- for cache eviction
);

CREATE INDEX idx_media_cache_domain ON media_cache(origin_domain);
CREATE INDEX idx_media_cache_expires ON media_cache(expires_at);
```

### Implementation

1. **Instance actor** — Every CommonPub instance has an Application actor:
   ```json
   {
     "type": "Application",
     "id": "https://hack.build/actor",
     "preferredUsername": "hack.build",
     "inbox": "https://hack.build/actor/inbox",
     "outbox": "https://hack.build/actor/outbox",
     "publicKey": { "...": "..." }
   }
   ```
   When followed, the instance actor Announces all public content.

2. **Initial sync** — `syncMirror(db, mirrorId)`:
   - Paginate the source instance's outbox (`GET /actor/outbox?page=1`)
   - Process each page: parse objects, store in `federated_content`
   - Save cursor for resumability
   - Rate-limit to avoid overwhelming source

3. **Media caching** — When `cache_media` is enabled:
   - Download images/attachments from remote URLs
   - Store locally via storage adapter (S3 or local)
   - Rewrite URLs in cached content to point to local copies
   - Evict based on `media_budget_mb` (LRU by `last_accessed_at`)

4. **Mirror management API**:
   - `POST /api/admin/mirrors` — Create mirror (admin only)
   - `GET /api/admin/mirrors` — List mirrors with sync status
   - `PUT /api/admin/mirrors/[id]` — Update config (pause, change content types)
   - `DELETE /api/admin/mirrors/[id]` — Remove mirror + optionally delete cached content
   - `POST /api/admin/mirrors/[id]/sync` — Trigger manual sync

### Content Type Filtering

Mirrors can filter by content type. Instance B might only want to mirror projects and articles, not blog posts. The `content_types` field controls this:

```typescript
// When processing incoming content:
if (mirror.contentTypes.includes(content.cpub_type ?? content.ap_type)) {
  await persistFederatedContent(db, content);
}
```

### Estimated Effort: Large

---

## Phase 8: BOM Federation

**Goal**: When a project on Instance A uses a product from Instance B, the BOM link is federated. The product gallery on Instance B shows projects from Instance A.

**This is unique to CommonPub.** No other fediverse software does this.

### How It Works

```
Alice on hack.build publishes a project with BOM:
  - Arduino Nano (linked to circuits.community/products/arduino-nano)
  - MG996R Servo (freeform, no product link)

hack.build sends Create(Article) with cpub:bom to followers
  → circuits.community receives it
  → circuits.community sees BOM contains a reference to its own product
  → circuits.community creates a contentProducts entry linking the remote project to the local product
  → The Arduino Nano product gallery now shows Alice's project
```

### Implementation

1. **BOM URI resolution** — When a BOM entry contains a `productUri`:
   - Check if the URI points to a local product → create `contentProducts` link
   - Check if the URI points to a known remote product → create link with remote flag
   - Unknown URI → store as freeform BOM entry

2. **Inbound BOM processing** — When receiving a Create(Article) with `cpub:bom`:
   ```typescript
   for (const part of article['cpub:bom']) {
     if (part.productUri) {
       const localProduct = await findProductByUri(db, part.productUri);
       if (localProduct) {
         await addRemoteContentToProductGallery(db, {
           productId: localProduct.id,
           remoteContentUri: article.id,
           quantity: part.quantity,
           role: part.role,
         });
       }
     }
   }
   ```

3. **Gallery queries** — `listProductContent()` now includes federated content:
   ```sql
   SELECT * FROM (
     -- Local projects using this product
     SELECT ci.* FROM content_items ci
     JOIN content_products cp ON cp.content_id = ci.id
     WHERE cp.product_id = $1
     UNION ALL
     -- Remote projects using this product
     SELECT fc.* FROM federated_content fc
     JOIN product_gallery_remote pgr ON pgr.remote_content_uri = fc.object_uri
     WHERE pgr.product_id = $1
   ) combined
   ORDER BY published_at DESC
   ```

### Schema Changes

```sql
CREATE TABLE product_gallery_remote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  remote_content_uri text NOT NULL,
  quantity int DEFAULT 1,
  role varchar(64),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(product_id, remote_content_uri)
);

CREATE INDEX idx_pgr_product ON product_gallery_remote(product_id);
CREATE INDEX idx_pgr_content ON product_gallery_remote(remote_content_uri);
```

### Estimated Effort: Medium

---

## Phase 9: Selective Federation

**Goal**: Admins control exactly what federates from their instance. Per content type, per hub, per user.

### Schema Changes

```sql
-- Instance-level federation config
ALTER TABLE instance_settings ADD COLUMN federation_mode varchar(16) DEFAULT 'open';
-- 'open' = federate everything public
-- 'selective' = only federate what's explicitly enabled
-- 'allowlist' = only federate with approved instances

-- Per-content-type federation control
CREATE TABLE federation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What to control
  rule_type varchar(32) NOT NULL, -- 'content_type', 'hub', 'user', 'domain'
  rule_value text NOT NULL, -- the content type, hub ID, user ID, or domain
  -- Action
  action varchar(16) NOT NULL, -- 'allow', 'deny'
  -- Scope
  direction varchar(16) DEFAULT 'both', -- 'inbound', 'outbound', 'both'
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(rule_type, rule_value, direction)
);

-- Instance allowlist/blocklist
CREATE TABLE federation_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain varchar(255) NOT NULL UNIQUE,
  status varchar(16) DEFAULT 'allowed' NOT NULL, -- 'allowed', 'blocked', 'silenced'
  reason text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### Implementation

1. **Federation guard** — Before delivering any activity, check:
   ```typescript
   async function shouldFederate(db, content, targetDomain): Promise<boolean> {
     // Check instance blocklist
     // Check federation mode
     // Check content type rules
     // Check hub-specific rules
     // Check user-specific rules
     return allowed;
   }
   ```

2. **Admin UI** — Federation settings panel:
   - Instance mode: open / selective / allowlist
   - Content type toggles: projects ✓, articles ✓, blogs ✗, explainers ✓
   - Hub-level: per hub "Federate this hub?" toggle
   - Instance management: block/silence/allow specific domains
   - User-level: users can opt out of federation for their content

3. **Moderation tools**:
   - `POST /api/admin/federation/block` — Block an instance
   - `POST /api/admin/federation/silence` — Silence (don't show in feeds but accept)
   - `GET /api/admin/federation/instances` — List known instances with status
   - `Flag` activity support — Forward reports to remote instance admins

### Estimated Effort: Medium

---

## Phase 10: Relay & Discovery

**Goal**: Topic-aware content distribution and instance discovery.

### Relay Architecture

Standard fediverse relays broadcast everything to everyone. CommonPub relays are **topic-aware**: they filter by content type and tags.

```json
{
  "type": "Service",
  "id": "https://relay.commonpub.org/actor",
  "preferredUsername": "relay",
  "name": "CommonPub Makers Relay",
  "summary": "Relays maker content across CommonPub instances",
  "inbox": "https://relay.commonpub.org/inbox",
  "cpub:relayTopics": ["project", "article", "product"],
  "cpub:relayTags": ["#electronics", "#robotics", "#3dprinting"]
}
```

### Implementation

1. **Relay subscription** — Instance follows a relay's Service actor. Relay forwards matching content via Announce.

2. **Built-in relay mode** — Any CommonPub instance can act as a relay:
   - Feature flag: `relay: true` in config
   - Accepts Follow from other instances
   - Filters incoming content by configured topics/tags
   - Re-Announces matching content to all subscribers

3. **Instance directory** — `/api/federation/directory`:
   - Lists known CommonPub instances with their topics, user counts, content counts
   - Populated from NodeInfo of discovered instances
   - Optional: submit to a global CommonPub directory (like joinmastodon.org)

4. **NodeInfo extensions** — Advertise CommonPub capabilities:
   ```json
   {
     "software": { "name": "commonpub", "version": "1.0.0" },
     "protocols": ["activitypub"],
     "metadata": {
       "commonpub": {
         "version": "1.0.0",
         "contentTypes": ["project", "article", "blog", "explainer"],
         "hubTypes": ["community", "product", "company"],
         "features": ["bom", "learning", "docs"],
         "namespace": "https://commonpub.org/ns/v1#"
       }
     }
   }
   ```

### Estimated Effort: Medium

---

## Implementation Priority & Dependencies

```
                    ┌─────────────┐
                    │  Phase 1    │
                    │  Outbound   │
                    │  Delivery   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │  Phase 2  │ │Phase 4│ │  Phase 5  │
        │  Inbound  │ │OAuth2 │ │ Namespace │
        │  Persist  │ │Consumer│ │           │
        └─────┬─────┘ └───────┘ └─────┬─────┘
              │                       │
        ┌─────▼─────┐               │
        │  Phase 3  │               │
        │Cross-Inst │               │
        │Interaction│               │
        └─────┬─────┘               │
              │                     │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │      Phase 6       │
              │  Hub Federation    │
              │  (Groups)          │
              └──────────┬──────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        ┌─────▼────┐ ┌──▼──────┐ ┌▼──────────┐
        │ Phase 7  │ │ Phase 8 │ │  Phase 9  │
        │ Mirror   │ │ BOM Fed │ │ Selective │
        └──────────┘ └─────────┘ └───────────┘
                         │
              ┌──────────▼──────────┐
              │     Phase 10       │
              │  Relay & Discovery │
              └────────────────────┘
```

### Critical Path

**Phase 1 → Phase 2 → Phase 3 → Phase 6** is the critical path to "hubs can be federated."

**Phase 5** (namespace) can be done in parallel with Phases 2–3 but must be done before Phase 6.

**Phase 4** (OAuth2 consumer) is independent and can be done anytime.

---

## Standing Rule Updates

The following standing rules need revision for full federation:

| Rule | Current | Proposed Change |
|------|---------|----------------|
| #5 | "Hubs local-only in v1 — AP Group only after real moderation experience" | **Keep for v1.** Phase 6 (Hub Federation) is explicitly post-v1. Gate behind `federation.hubs` feature flag. |
| #10 | "No federation before two instances exist with real content" | **Keep.** Phase 1–3 should only ship after two real instances exist. |
| — | (new) | "Federation failures never break local operations" |
| — | (new) | "Every AP object must degrade gracefully to standard Article/Note" |
| — | (new) | "Instance admins control what federates — never all-or-nothing" |

---

## What Makes This Truly Amazing

1. **No one federates structured content.** Mastodon federates status updates. Lemmy federates link posts. PeerTube federates videos. BookWyrm federates book reviews. CommonPub federates **projects with bills of materials, products with specs, learning paths, and documentation.** This is genuinely new.

2. **The BOM graph is a network effect.** When Instance A's project uses Instance B's product, both benefit. The product gallery grows. The project gets more exposure. This creates incentive for federation that most fediverse apps lack.

3. **Hubs as Group actors are communities without borders.** A robotics community on `hack.build` can have members from 50 different instances, all participating in the same discussion, seeing the same content, with consistent moderation. This is the promise of federated social that no one has fully delivered.

4. **Graceful degradation means instant network effects.** A CommonPub project shared to Mastodon is a readable article. A CommonPub project shared to another CommonPub instance is a rich, interactive experience. You get value from day one with the broader fediverse, and increasing value as more CommonPub instances join.

5. **Selective federation respects sovereignty.** Instance admins aren't forced into all-or-nothing. A company can federate their products but keep their internal hubs private. A learning platform can federate courses but not student progress.

6. **Topic-aware relays create focused networks.** Instead of a firehose of everything, relays distribute electronics projects to electronics communities, 3D printing content to 3D printing communities. This is signal, not noise.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Mastodon ignores Article type | Users on Mastodon don't see CommonPub content well | Test with real Mastodon instances. Use `content` field with full HTML. Add summary. Mastodon does support Article. |
| Hub federation complexity | Group forwarding has edge cases (loops, duplicates) | Follow Lemmy's proven pattern. Deduplicate by object URI. Track Announced activities. |
| Content drift after federation | Edits on origin don't propagate | Always send Update activities. Include `updated` timestamp. Remote instances must handle Update. |
| Media cache explosion | Mirroring fills disk | Budget-based cache with LRU eviction. Default 5GB limit. Admin configurable. |
| Moderation across instances | Remote user posts harmful content | Hub moderators can ban remote users. Remote content goes through validation before Announce. Content moderation is hub-local. |
| Spam via federation | Spam instances flood content | Instance blocklist. Rate limiting per-domain. Silence mode. Authorized fetch mode for sensitive hubs. |
| Schema evolution breaks federation | v2 namespace incompatible with v1 | Versioned namespace (`/ns/v1#`). Never remove properties. New properties are optional. Advertise version in NodeInfo. |

---

## Files Created By This Plan

- `docs/federation-plan.md` — This file (master plan)
- `docs/federation-testing-plan.md` — 7-layer testing strategy with every test case specified
- `docs/federation-notes.md` — Research notes, decisions log, open questions
- `docs/federation.md` — Public-facing federation guide with diagrams
- `docs/reference/fedify-research.md` — Fedify 2.0 technical reference (created by research agent)
- `docs/archive/research/federation-system.md` — AP federation research (archived)
