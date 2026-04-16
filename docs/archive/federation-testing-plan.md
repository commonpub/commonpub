# Federation Testing Plan

> Written 2026-03-20. Companion to `docs/federation-plan.md`.
> Covers every layer of testing needed to validate federation before, during, and after implementation.

---

## Current State

### What Exists (881 tests passing)

| Layer | Tests | Status |
|-------|-------|--------|
| **Schema validators** | Enum values, table shapes, Zod schemas for federation tables | Complete |
| **Protocol unit tests** | WebFinger, NodeInfo, activities (all 9 types), actor resolver, HTTP signature verification, inbox dispatcher, outbox, content mapper, keypair generation | Complete (14 files) |
| **Auth SSO unit tests** | SSO config, OAuth discovery, trusted instance check | Complete |
| **Auth SSO integration** | Full Model B OAuth flow (WebFinger → Authorize → Token) with mocked fetch | Complete |
| **Server federation** | Export existence checks only (stub) | **Not real tests** |
| **Server integration** | PGlite-based tests for content, hub, social, product, contest, learning | Complete (but zero federation coverage) |
| **Multi-instance** | `docker-compose.federation.yml` + `federation-seed.ts` exist | **Infrastructure only, no tests** |
| **E2E** | None | **Missing entirely** |

### What's Missing

1. No tests that federation server functions actually work with a database
2. No tests that activities are correctly created/stored when content is published
3. No tests that inbound activities modify database state correctly
4. No tests that HTTP signatures are generated correctly on outbound requests
5. No tests that two instances can exchange activities
6. No tests that content from Mastodon/Lemmy/Misskey is correctly parsed
7. No tests that CommonPub namespace extensions round-trip correctly
8. No tests for hub federation (Group actors, Announce wrapping)
9. No tests for BOM federation (cross-instance product gallery)
10. No tests for content mirroring
11. No security regression tests (signature tampering, SSRF, XSS in federated content)

---

## Testing Architecture

Seven layers, from fastest/cheapest to slowest/most comprehensive:

```
Layer 7: Interop Tests         (Docker + real AP software)     ~minutes
Layer 6: E2E Tests             (Playwright + browser)          ~seconds
Layer 5: Two-Instance Tests    (Docker Compose)                ~seconds
Layer 4: Federation Flow Tests (@fedify/testing)               ~100ms
Layer 3: Integration Tests     (PGlite + real DB)              ~100ms
Layer 2: Unit Tests            (pure functions, mocked IO)     ~10ms
Layer 1: Type-Level Tests      (TypeScript compiler)           ~0ms
```

Most tests should be at Layers 2–4. Layers 5–7 are for confidence, not coverage.

---

## Layer 1: Type-Level Tests

**Cost**: Zero runtime. Caught by `pnpm typecheck`.

### What to Test

- AP object types match spec (already done in `activityTypes.ts`)
- CommonPub namespace types are correct
- Content mapper input/output types are strict
- Fedify dispatcher types match Fedify 2.0 API
- Database query return types are correct (Phase A of plan-v3)

### How

TypeScript strict mode is already enabled. Add type tests for new federation types:

```typescript
// packages/protocol/src/__tests__/types.test.ts
import type { APArticle, APGroup, CPubProject, CPubProduct } from '../types';
import { expectTypeOf } from 'vitest';

it('CPubProject extends APArticle', () => {
  expectTypeOf<CPubProject>().toMatchTypeOf<APArticle>();
});

it('APGroup has required Group fields', () => {
  expectTypeOf<APGroup>().toHaveProperty('inbox');
  expectTypeOf<APGroup>().toHaveProperty('outbox');
  expectTypeOf<APGroup>().toHaveProperty('followers');
});
```

---

## Layer 2: Unit Tests (Pure Functions, Mocked IO)

**Cost**: ~10ms per test. Run on every save.

These test individual functions in isolation. No database, no network, no Fedify.

### 2.1 CommonPub Namespace (Phase 5)

New tests in `packages/protocol/src/__tests__/`:

```
namespace.test.ts
├── buildCommonPubContext()
│   ├── includes AS2 context
│   ├── includes security context
│   ├── includes cpub namespace
│   └── only includes extensions for types used
│
├── isCommonPubObject()
│   ├── returns true for objects with cpub:type
│   ├── returns false for standard AP objects
│   └── handles missing @context gracefully
│
└── extractCommonPubMetadata()
    ├── extracts cpub:type from Article
    ├── extracts cpub:bom from project
    ├── extracts cpub:specs from product
    ├── returns null for non-cpub objects
    └── handles malformed metadata without throwing
```

### 2.2 Extended Content Mapper (Phase 5)

Extend existing `contentMapper.test.ts`:

```
contentMapper.test.ts (extended)
├── contentToAPObject()
│   ├── project → Article + cpub:type + cpub:bom + cpub:difficulty
│   ├── article → Article + cpub:type
│   ├── blog → Article + cpub:type
│   ├── explainer → Article + cpub:type + cpub:sections
│   ├── product → Document + cpub:specs + cpub:purchaseUrl
│   ├── learning path → Collection + cpub:learningPath
│   ├── always includes standard AP type
│   ├── always includes to/cc addressing
│   └── BOM entries with productUri include full URI
│
├── apObjectToContent()
│   ├── standard Article → content with type 'article'
│   ├── cpub Article with cpub:type 'project' → content with type 'project'
│   ├── cpub Article with cpub:bom → BOM extracted to metadata
│   ├── standard Document → content with type 'article' (fallback)
│   ├── cpub Document with cpub:specs → product fields extracted
│   └── unknown cpub:type → fallback to ap_type mapping
│
├── Round-trip fidelity
│   ├── project → AP → project (lossless)
│   ├── article → AP → article (lossless)
│   ├── product → AP → product (lossless)
│   └── BOM with productUris → AP → BOM (URIs preserved)
│
└── Graceful degradation
    ├── project without cpub context → valid Article
    ├── product without cpub context → valid Document
    └── stripping cpub: properties leaves valid AP object
```

### 2.3 Hub Actor Builder (Phase 6)

New file `hubMapper.test.ts`:

```
hubMapper.test.ts
├── hubToGroup()
│   ├── community hub → Group with cpub:hubType 'community'
│   ├── product hub → Group with cpub:hubType 'product'
│   ├── company hub → Organization with cpub:hubType 'company'
│   ├── includes inbox/outbox/followers URLs
│   ├── includes publicKey
│   ├── includes attributedTo (owner)
│   ├── includes joinPolicy
│   └── WebFinger handle is hub slug
│
├── groupToHub()
│   ├── remote Group → hub with hubType from cpub:hubType
│   ├── remote Group without cpub:hubType → default 'community'
│   └── remote Organization → hub with hubType 'company'
│
└── buildHubAnnounce()
    ├── wraps Create(Note) in Announce with hub as actor
    ├── preserves original activity in object
    ├── adds audience field
    └── to/cc addresses all hub followers
```

### 2.4 HTTP Signature Signing (Phase 1)

Extend existing `httpSignature.test.ts`:

```
httpSignature.test.ts (extended)
├── signRequest()
│   ├── adds Signature header to request
│   ├── adds Date header if missing
│   ├── adds Digest header for POST requests
│   ├── signs (request-target), host, date, digest
│   ├── keyId matches actor#main-key format
│   ├── algorithm is rsa-sha256
│   └── signed request verifies with corresponding public key
│
├── Roundtrip: sign → verify
│   ├── generate keypair → sign → verify → passes
│   ├── generate keypair → sign → tamper body → verify → fails
│   ├── generate keypair → sign → tamper header → verify → fails
│   └── generate keypair → sign → wrong public key → verify → fails
│
└── Edge cases
    ├── handles request with existing Date header (preserves it)
    ├── handles request with existing Digest header (replaces it)
    ├── handles empty POST body
    └── handles non-POST methods (GET has no Digest)
```

### 2.5 HTML Sanitization (Phase 2)

New file `sanitize.test.ts`:

```
sanitize.test.ts
├── Allowed elements preserved
│   ├── <p>, <a>, <img>, <h1>–<h6> pass through
│   ├── <ul>, <ol>, <li>, <blockquote> pass through
│   ├── <code>, <pre>, <em>, <strong>, <br> pass through
│   └── href/src attributes preserved on allowed elements
│
├── Dangerous elements stripped
│   ├── <script> removed entirely
│   ├── <iframe> removed entirely
│   ├── <object>, <embed> removed
│   ├── <form>, <input> removed
│   └── <style> with expressions removed
│
├── Dangerous attributes stripped
│   ├── onclick, onload, onerror removed
│   ├── javascript: URLs removed from href
│   ├── data: URLs with executable MIME types removed
│   ├── vbscript: URLs removed
│   └── style attributes with url() removed
│
├── Real-world XSS payloads
│   ├── Mastodon XSS payload from OWASP cheat sheet
│   ├── SVG/onload payload
│   ├── IMG/onerror payload
│   ├── Unicode obfuscation (javascript\u003a)
│   └── Nested encoding attempts
│
└── Preserves legitimate content
    ├── Markdown-generated HTML unchanged
    ├── Code blocks with < > characters preserved
    ├── External image URLs preserved
    └── Internal links preserved
```

### 2.6 Activity Builder Completeness

Extend existing `activities.test.ts` for new activity types:

```
activities.test.ts (extended for Phase 6)
├── buildHubAnnounce()
│   ├── wraps activity with Group actor
│   ├── includes audience field
│   └── to addresses public + followers
│
├── buildBlockActivity()
│   ├── actor is hub, object is banned user
│   └── includes target (hub URI)
│
├── buildAddModeratorActivity()
│   ├── actor is hub
│   ├── object is new moderator
│   └── target is moderators collection
│
└── buildRemoveModeratorActivity()
    ├── mirrors Add structure
    └── target is moderators collection
```

---

## Layer 3: Integration Tests (PGlite + Real DB)

**Cost**: ~100ms per test. Run before commit.

These test federation server functions against a real (in-memory) Postgres database. Same pattern as existing `content.integration.test.ts`.

### 3.1 Federation Server Integration

New file: `packages/server/src/__tests__/federation.integration.test.ts`

```
federation.integration.test.ts
│
├── Keypair Management
│   ├── getOrCreateActorKeypair() creates new keypair for user
│   ├── getOrCreateActorKeypair() returns existing keypair on second call
│   ├── keypair is valid RSA-2048
│   └── different users get different keypairs
│
├── Content Federation
│   ├── federateContent() creates Create activity in DB
│   │   ├── activity type is 'Create'
│   │   ├── direction is 'outbound'
│   │   ├── status is 'pending'
│   │   ├── actorUri matches author
│   │   ├── objectUri matches content slug
│   │   └── payload contains valid AP Article
│   │
│   ├── federateUpdate() creates Update activity
│   ├── federateDelete() creates Delete activity with Tombstone
│   ├── federateLike() creates Like activity
│   │
│   ├── federateContent() is no-op for unpublished content
│   └── federateContent() includes BOM in payload when present (Phase 5+)
│
├── Follow Lifecycle
│   ├── sendFollow() creates pending followRelationship + Follow activity
│   ├── acceptFollow() updates status to 'accepted' + creates Accept activity
│   ├── rejectFollow() updates status to 'rejected' + creates Reject activity
│   ├── unfollowRemote() deletes relationship + creates Undo activity
│   ├── sendFollow() throws for non-existent user
│   ├── duplicate follow throws (unique constraint)
│   └── acceptFollow() for non-existent relationship throws
│
├── Actor Resolution
│   ├── resolveRemoteActor() with cache miss → fetches and caches (mocked fetch)
│   ├── resolveRemoteActor() with fresh cache → returns cached (no fetch)
│   ├── resolveRemoteActor() with stale cache (>24h) → re-fetches
│   └── resolveRemoteActor() with fetch failure → returns null
│
├── Queries
│   ├── getFollowers() returns only accepted followers
│   ├── getFollowing() returns only accepted following
│   ├── listFederationActivity() with no filters → all activities
│   ├── listFederationActivity() filter by direction
│   ├── listFederationActivity() filter by status
│   ├── listFederationActivity() filter by type
│   ├── listFederationActivity() pagination (limit + offset)
│   └── listFederationActivity() total count is accurate
│
└── Content + Federation Combined
    ├── publishContent() with federation enabled → creates activity
    ├── publishContent() with federation disabled → no activity
    ├── updateContent() after publish → creates Update activity
    └── deleteContent() after publish → creates Delete activity
```

### 3.2 Inbound Content Persistence Integration (Phase 2)

New file: `packages/server/src/__tests__/federation-inbound.integration.test.ts`

```
federation-inbound.integration.test.ts
│
├── Inbound Create (Article)
│   ├── stores in federated_content table
│   ├── sanitizes HTML content
│   ├── extracts title, summary, published date
│   ├── extracts cover image from attachments
│   ├── extracts tags
│   ├── stores origin_domain from actor URI
│   ├── sets ap_type to 'Article'
│   ├── duplicate object_uri → updates existing (idempotent)
│   └── from CommonPub instance → extracts cpub_type and cpub_metadata
│
├── Inbound Create (Note)
│   ├── stores as Note with content
│   ├── extracts inReplyTo
│   └── links to parent content if inReplyTo is local
│
├── Inbound Update
│   ├── updates existing federated_content row
│   ├── updates content, title, summary
│   ├── sets updated_at
│   ├── non-existent object_uri → stores as new (late Create)
│   └── re-sanitizes HTML
│
├── Inbound Delete
│   ├── sets deleted_at on federated_content row
│   ├── non-existent object_uri → no-op (idempotent)
│   └── Tombstone object → extracts formerType
│
├── Inbound Like (for local content)
│   ├── increments local_like_count on federated_content
│   ├── creates notification for content author
│   └── duplicate Like from same actor → idempotent
│
├── Inbound Announce (hub re-broadcast)
│   ├── unwraps inner activity
│   ├── processes inner Create/Update/Delete
│   └── stores hub_uri from Announce actor
│
└── Federated Feed
    ├── listFederatedFeed() returns content from followed actors
    ├── listFederatedFeed() excludes soft-deleted content
    ├── listFederatedFeed() sorted by published_at DESC
    ├── listFederatedFeed() pagination works
    └── listFederatedFeedByDomain() filters by origin
```

### 3.3 Cross-Instance Interaction Integration (Phase 3)

New file: `packages/server/src/__tests__/federation-interaction.integration.test.ts`

```
federation-interaction.integration.test.ts
│
├── Like Remote Content
│   ├── creates local like with remote_object_uri
│   ├── increments local_like_count on federated_content
│   ├── creates outbound Like activity
│   └── unlike creates Undo(Like) activity
│
├── Comment on Remote Content
│   ├── creates local comment with remote_object_uri
│   ├── creates outbound Create(Note) activity
│   ├── Note has inReplyTo set to remote object URI
│   ├── increments local_comment_count on federated_content
│   └── delete comment creates Delete activity
│
├── Receive Remote Interaction on Local Content
│   ├── inbound Like → increments like count on local contentItems
│   ├── inbound Like → creates notification for author
│   ├── inbound Create(Note inReplyTo local) → stores as comment
│   ├── inbound Create(Note inReplyTo local) → creates notification
│   └── inbound Undo(Like) → decrements like count
│
└── Bookmark Remote Content
    ├── creates local bookmark with remote_object_uri
    ├── no outbound activity (bookmarks are local)
    └── unbookmark removes local bookmark only
```

### 3.4 Hub Federation Integration (Phase 6)

New file: `packages/server/src/__tests__/hub-federation.integration.test.ts`

```
hub-federation.integration.test.ts
│
├── Hub Actor
│   ├── hub has its own keypair (separate from owner)
│   ├── hub keypair persists across owner changes
│   └── hub WebFinger returns Group actor
│
├── Remote Member Management
│   ├── inbound Follow → creates remote_hub_members row (pending or active)
│   ├── open hub: Follow → auto-accept → active member
│   ├── approval hub: Follow → pending → admin accepts → active
│   ├── invite hub: Follow without token → reject
│   ├── Undo(Follow) → removes remote_hub_members row
│   └── ban remote member → status = 'banned'
│
├── Hub Content Distribution (Announce Pipeline)
│   ├── local post → Announce created with hub as actor
│   ├── Announce includes full Create activity in object
│   ├── Announce addresses all hub followers
│   ├── remote Create(Note audience: hub) from member → validate → Announce
│   ├── remote Create from non-member → reject (no Announce)
│   ├── remote Create from banned member → reject
│   └── moderation: remove post → Undo(Announce) + Announce(Delete)
│
├── Following Remote Hubs
│   ├── follow remote hub → creates followed_hubs row
│   ├── receive Announce from remote hub → store in hub_federated_posts
│   ├── receive Announce(Delete) → soft-delete hub_federated_posts row
│   └── unfollow remote hub → removes followed_hubs row
│
└── Hub Moderation Activities
    ├── ban remote user → Block activity created
    ├── kick remote user → Remove activity created
    ├── promote to moderator → Add activity created
    └── demote from moderator → Remove activity created
```

### 3.5 BOM Federation Integration (Phase 8)

New file: `packages/server/src/__tests__/bom-federation.integration.test.ts`

```
bom-federation.integration.test.ts
│
├── Outbound BOM
│   ├── publish project with BOM → Create Article includes cpub:bom
│   ├── BOM entries with local productId → resolved to product URI
│   ├── BOM entries without productId → freeform (name only)
│   └── update project BOM → Update Article with new cpub:bom
│
├── Inbound BOM Processing
│   ├── receive Article with cpub:bom referencing local product
│   │   → creates product_gallery_remote row
│   ├── receive Article with cpub:bom referencing unknown product
│   │   → no gallery link (freeform entry only)
│   ├── receive Update with changed BOM
│   │   → updates product_gallery_remote rows
│   ├── receive Delete → removes product_gallery_remote rows
│   └── duplicate processing is idempotent
│
└── Gallery Queries with Federated Content
    ├── listProductContent() includes local + remote projects
    ├── listProductContent() remote projects have correct metadata
    └── remote project deletion removes from gallery
```

### 3.6 Content Mirroring Integration (Phase 7)

New file: `packages/server/src/__tests__/mirror.integration.test.ts`

```
mirror.integration.test.ts
│
├── Mirror Configuration
│   ├── create mirror → instance_mirrors row created
│   ├── pause mirror → status updated
│   ├── delete mirror → row removed
│   └── content_types filter stores correctly
│
├── Content Type Filtering
│   ├── mirror with ["project", "article"] → stores projects, skips blogs
│   ├── mirror with ["*"] → stores everything
│   └── filter change takes effect on next activity
│
├── Media Cache Management
│   ├── cache_media=true → downloads and stores remote images
│   ├── cache_media=false → leaves URLs pointing to origin
│   ├── media_budget_mb enforcement → evicts LRU when over budget
│   └── media_cache table tracks size, domain, access time
│
└── Mirror State
    ├── items_synced counter increments
    ├── last_sync_at updates on each activity
    ├── error stored on failure
    └── sync_cursor saves pagination position
```

---

## Layer 4: Federation Flow Tests (@fedify/testing)

**Cost**: ~100ms per test. Run before commit.

These use Fedify's `@fedify/testing` package (available since v1.9.1) to test full federation flows without any HTTP. MockFederation tracks sent activities and simulates inbox delivery.

### 4.1 Setup

```typescript
// packages/server/src/__tests__/helpers/federation-test.ts
import { createFederation } from '@fedify/testing';
import { createTestDB, createTestUser } from './testdb.js';
import type { DB } from '../../types.js';

export interface FederationTestContext {
  db: DB;
  federation: ReturnType<typeof createFederation>;
  localDomain: string;
  remoteDomain: string;
}

export async function createFederationTestContext(): Promise<FederationTestContext> {
  const db = await createTestDB();
  const federation = createFederation({
    // Fedify test federation with in-memory queue
  });

  return {
    db,
    federation,
    localDomain: 'local.test',
    remoteDomain: 'remote.test',
  };
}
```

### 4.2 Follow Flow Test

```
federation-flow-follow.test.ts
│
├── Full outbound follow flow
│   ├── User sends follow → Follow activity queued
│   ├── Activity delivered to remote inbox (mock)
│   ├── Remote sends Accept → processed via receiveActivity()
│   ├── followRelationship status updated to 'accepted'
│   └── Activity log shows Follow(pending) → Accept(processed)
│
├── Full inbound follow flow
│   ├── Remote sends Follow → receiveActivity() to local inbox
│   ├── followRelationship created (pending)
│   ├── Auto-accept → Accept activity queued for delivery
│   ├── Remote receives Accept
│   └── followRelationship status is 'accepted'
│
├── Unfollow flow
│   ├── User unfollows → Undo(Follow) activity queued
│   ├── followRelationship deleted
│   └── Remote receives Undo
│
└── Reject flow
    ├── Remote sends Follow
    ├── Local user rejects → Reject activity queued
    ├── followRelationship status is 'rejected'
    └── Remote receives Reject
```

### 4.3 Content Delivery Flow Test

```
federation-flow-content.test.ts
│
├── Publish → Deliver → Persist
│   ├── Alice publishes article on local
│   ├── Create(Article) activity queued
│   ├── Delivered to follower Bob's inbox on remote
│   ├── Remote processes Create → stores in federated_content
│   └── Bob's federated feed shows Alice's article
│
├── Update → Propagate
│   ├── Alice edits article
│   ├── Update(Article) activity queued
│   ├── Delivered to Bob's inbox
│   ├── Remote processes Update → federated_content updated
│   └── Bob sees updated article
│
├── Delete → Propagate
│   ├── Alice deletes article
│   ├── Delete(Tombstone) activity queued
│   ├── Delivered to Bob's inbox
│   ├── Remote processes Delete → federated_content soft-deleted
│   └── Article no longer in Bob's feed
│
└── Like → Notify
    ├── Bob likes Alice's article
    ├── Like activity queued, delivered to Alice's inbox
    ├── Local processes Like → like count incremented
    └── Alice gets notification
```

### 4.4 Hub Federation Flow Test

```
federation-flow-hub.test.ts
│
├── Join Hub
│   ├── Remote user follows hub Group actor
│   ├── Hub processes Follow
│   ├── Hub sends Accept (open hub)
│   ├── remote_hub_members row created (active)
│   └── Remote receives Accept
│
├── Post to Hub (Local)
│   ├── Local member creates hub post
│   ├── Hub wraps in Announce
│   ├── Announce delivered to ALL hub followers
│   ├── Remote receives Announce
│   └── Remote stores post in hub_federated_posts
│
├── Post to Hub (Remote)
│   ├── Remote member sends Create(Note audience: hub) to hub inbox
│   ├── Hub validates: member? content ok?
│   ├── Hub wraps in Announce
│   ├── Announce delivered to all followers (including sender's instance)
│   └── All instances store the post
│
├── Post to Hub (Rejected)
│   ├── Non-member sends Create to hub inbox
│   ├── Hub rejects (not a member)
│   └── No Announce sent, no content stored
│
├── Moderation: Ban
│   ├── Moderator bans remote user
│   ├── Block activity delivered
│   ├── remote_hub_members status → 'banned'
│   ├── Banned user posts → rejected
│   └── All followers notified of ban
│
└── Leave Hub
    ├── Remote user sends Undo(Follow)
    ├── remote_hub_members row removed
    └── User no longer receives Announces
```

### 4.5 BOM Federation Flow Test

```
federation-flow-bom.test.ts
│
├── Publish Project with BOM
│   ├── Alice publishes project with BOM referencing product on remote
│   ├── Create(Article) with cpub:bom delivered to followers
│   ├── Remote (which hosts the product) receives Create
│   ├── Remote detects own product in BOM
│   ├── product_gallery_remote row created
│   └── Product gallery page shows Alice's project
│
├── Update BOM
│   ├── Alice adds new product to BOM
│   ├── Update(Article) delivered
│   ├── Remote processes Update, adds new gallery link
│   └── Product gallery updated
│
└── Delete Project
    ├── Alice deletes project
    ├── Delete(Tombstone) delivered
    ├── Remote removes product_gallery_remote rows
    └── Product gallery no longer shows project
```

---

## Layer 5: Two-Instance Tests (Docker Compose)

**Cost**: ~seconds per test. Run in CI.

These use `deploy/docker-compose.federation.yml` to spin up two real CommonPub instances with separate databases, then test actual HTTP-level federation.

### 5.1 Infrastructure

```yaml
# deploy/docker-compose.federation-test.yml
services:
  postgres-a:
    image: postgres:16
    environment:
      POSTGRES_DB: commonpub_a
      POSTGRES_USER: commonpub
      POSTGRES_PASSWORD: test
    ports: ["5433:5432"]

  postgres-b:
    image: postgres:16
    environment:
      POSTGRES_DB: commonpub_b
      POSTGRES_USER: commonpub
      POSTGRES_PASSWORD: test
    ports: ["5434:5432"]

  redis:
    image: redis:7
    ports: ["6380:6379"]

  instance-a:
    build: .
    environment:
      DATABASE_URL: postgres://commonpub:test@postgres-a:5432/commonpub_a
      PUBLIC_URL: http://instance-a:3000
      AUTH_SECRET: test-secret-a-32-chars-minimum!!
      REDIS_URL: redis://redis:6379
    ports: ["3000:3000"]
    depends_on: [postgres-a, redis]

  instance-b:
    build: .
    environment:
      DATABASE_URL: postgres://commonpub:test@postgres-b:5432/commonpub_b
      PUBLIC_URL: http://instance-b:3001
      AUTH_SECRET: test-secret-b-32-chars-minimum!!
      REDIS_URL: redis://redis:6379
    ports: ["3001:3000"]
    depends_on: [postgres-b, redis]
```

### 5.2 Test Runner

New directory: `tests/federation/`

```typescript
// tests/federation/setup.ts
import { execSync } from 'child_process';

export async function setupFederationTests() {
  // 1. Start containers
  execSync('docker compose -f deploy/docker-compose.federation-test.yml up -d --wait');

  // 2. Push schema to both databases
  execSync('DATABASE_URL=postgres://commonpub:test@localhost:5433/commonpub_a pnpm db:push');
  execSync('DATABASE_URL=postgres://commonpub:test@localhost:5434/commonpub_b pnpm db:push');

  // 3. Seed test data (users, OAuth clients, mutual trust)
  execSync('npx tsx deploy/federation-seed.ts');
}

export async function teardownFederationTests() {
  execSync('docker compose -f deploy/docker-compose.federation-test.yml down -v');
}
```

### 5.3 Two-Instance Test Cases

```
tests/federation/
├── webfinger.test.ts
│   ├── Instance A resolves user on Instance B via WebFinger
│   ├── Instance B resolves user on Instance A via WebFinger
│   ├── Unknown user returns 404
│   └── Hub resolves via WebFinger (Phase 6)
│
├── actor.test.ts
│   ├── GET /users/alice on Instance A returns valid Person actor
│   ├── Actor includes publicKey
│   ├── Actor includes inbox/outbox/followers/following URLs
│   └── Content negotiation: HTML for browser, JSON-LD for AP client
│
├── follow.test.ts
│   ├── Bob on B follows Alice on A → Follow delivered → Accept returned
│   ├── followRelationship exists on both instances
│   ├── Alice's follower count reflects Bob
│   ├── Bob unfollows → Undo delivered → relationship removed
│   └── Reject flow: Alice rejects Bob's follow
│
├── content-delivery.test.ts
│   ├── Alice publishes on A → article appears in Bob's feed on B
│   ├── Alice edits → Bob sees updated version
│   ├── Alice deletes → article disappears from Bob's feed
│   └── HTML content is sanitized on B (no XSS)
│
├── interaction.test.ts
│   ├── Bob on B likes Alice's article on A → like count updates on A
│   ├── Bob comments → comment appears on A
│   ├── Bob unlikes → like count decrements on A
│   └── Alice gets notification for remote like/comment
│
├── hub-federation.test.ts (Phase 6)
│   ├── Bob on B follows Robotics hub on A → hub membership created
│   ├── Local post to hub → Bob receives via Announce
│   ├── Bob posts to hub from B → Announce distributed
│   ├── Moderator bans Bob → Bob can no longer post
│   └── Bob leaves hub → no longer receives Announces
│
├── bom-federation.test.ts (Phase 8)
│   ├── Alice's project on A references product on B
│   ├── Product gallery on B shows Alice's project
│   ├── Alice updates BOM → gallery updates
│   └── Alice deletes project → gallery entry removed
│
├── mirror.test.ts (Phase 7)
│   ├── Instance B mirrors Instance A
│   ├── Existing content synced via outbox pagination
│   ├── New content arrives via AP delivery
│   ├── Content type filter works
│   └── Delete on A → soft-delete on B
│
└── sso.test.ts
    ├── User on B logs in with A credentials
    ├── federatedAccounts row created on B
    ├── Subsequent logins reuse linked account
    └── Token refresh works
```

### 5.4 Test Helpers

```typescript
// tests/federation/helpers.ts
const INSTANCE_A = 'http://localhost:3000';
const INSTANCE_B = 'http://localhost:3001';

/** Fetch with ActivityPub content negotiation */
export async function apFetch(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/activity+json' },
  });
  return res.json();
}

/** POST an activity to an inbox */
export async function postToInbox(
  inbox: string,
  activity: unknown,
  signingKey: string,
  keyId: string,
): Promise<Response> {
  const body = JSON.stringify(activity);
  const request = new Request(inbox, {
    method: 'POST',
    headers: { 'Content-Type': 'application/activity+json' },
    body,
  });
  // Sign with HTTP Signatures
  const signed = await signRequest(request, signingKey, keyId);
  return fetch(signed);
}

/** Wait for async activity processing */
export async function waitForActivity(
  instanceUrl: string,
  objectUri: string,
  maxWaitMs = 5000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const activities = await fetch(
      `${instanceUrl}/api/admin/federation/activity?objectUri=${objectUri}`,
    ).then(r => r.json());
    if (activities.items.some(a => a.status === 'delivered' || a.status === 'processed')) {
      return;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Activity for ${objectUri} not processed within ${maxWaitMs}ms`);
}
```

---

## Layer 6: E2E Tests (Playwright)

**Cost**: ~seconds per test. Run in CI.

These test the user-facing federation experience in a real browser.

### 6.1 Test Cases

```
e2e/federation/
├── follow-remote-user.spec.ts
│   ├── Navigate to remote user profile
│   ├── Click "Follow"
│   ├── See "Following" state update
│   ├── Navigate to own feed
│   └── See remote user's content in feed
│
├── federated-feed.spec.ts
│   ├── Navigate to "Federated" feed tab
│   ├── See content from followed remote users
│   ├── Content shows origin instance badge
│   ├── Click article → see full content
│   └── Like button works on federated content
│
├── hub-federation.spec.ts (Phase 6)
│   ├── Navigate to remote hub
│   ├── Click "Join"
│   ├── See hub feed with local + remote posts
│   ├── Create post in hub
│   └── Post appears for other hub members
│
├── federation-admin.spec.ts
│   ├── Navigate to admin federation panel
│   ├── See known instances list
│   ├── Block an instance
│   ├── See activity log
│   └── Configure content type toggles
│
└── sso-login.spec.ts
    ├── Click "Login with [Instance A]"
    ├── Redirected to Instance A login page
    ├── Enter credentials
    ├── Redirected back to Instance B
    └── Logged in with linked account
```

---

## Layer 7: Interop Tests (Real AP Software)

**Cost**: ~minutes per test. Run weekly in CI or manually.

These test compatibility with actual fediverse software using real recorded payloads and optionally live instances.

### 7.1 Fixture-Based Tests (No Docker Required)

Record real AP payloads from Mastodon, Lemmy, Misskey and test our parsers against them.

```
tests/interop/fixtures/
├── mastodon/
│   ├── person-actor.json        # Real Mastodon Person actor
│   ├── create-note.json         # Status post
│   ├── create-article.json      # Long-form article (if available)
│   ├── follow.json              # Follow activity
│   ├── accept.json              # Accept activity
│   ├── like.json                # Favourite
│   ├── announce.json            # Boost
│   ├── delete-tombstone.json    # Delete with Tombstone
│   ├── update-note.json         # Edit
│   └── webfinger-response.json  # WebFinger JRD
│
├── lemmy/
│   ├── group-actor.json         # Community as Group
│   ├── person-actor.json        # Lemmy user
│   ├── create-page.json         # Post (Page type)
│   ├── create-note.json         # Comment
│   ├── announce-create.json     # Community Announce wrapping Create
│   ├── announce-delete.json     # Community Announce wrapping Delete
│   ├── block-user.json          # Ban from community
│   ├── add-moderator.json       # Add moderator
│   ├── like.json                # Upvote
│   ├── dislike.json             # Downvote
│   └── undo-follow.json         # Leave community
│
├── misskey/
│   ├── person-actor.json
│   ├── create-note.json
│   ├── like.json                # EmojiReact
│   ├── announce.json            # Renote
│   └── flag.json                # Report
│
├── bookwyrm/
│   ├── person-actor.json
│   ├── create-review.json       # Custom Review type (degrades to Article)
│   └── create-comment.json      # Custom Comment type
│
└── gotosocial/
    ├── person-actor.json
    ├── create-note.json
    └── follow.json
```

### 7.2 Fixture Test File

```
tests/interop/parse-fixtures.test.ts
│
├── Mastodon
│   ├── parse Person actor → valid remote actor fields
│   ├── parse Create(Note) → federated_content fields correct
│   ├── parse Follow → follow relationship created correctly
│   ├── parse Accept → follow status updated
│   ├── parse Like → like processed
│   ├── parse Announce → boost processed
│   ├── parse Delete(Tombstone) → soft delete
│   └── parse WebFinger → actor URI extracted
│
├── Lemmy
│   ├── parse Group actor → hub fields extracted
│   ├── parse Announce(Create(Page)) → unwrap and store content
│   ├── parse Announce(Delete) → soft delete content
│   ├── parse Block → ban processed
│   ├── parse Add → moderator added
│   ├── parse Like → upvote processed
│   └── parse Dislike → downvote (treat as no-op or negative like)
│
├── Misskey
│   ├── parse Person actor (with Misskey extensions) → valid
│   ├── parse Create(Note) → content stored
│   ├── parse EmojiReact → treat as Like
│   └── parse Announce → boost processed
│
├── BookWyrm
│   ├── parse Review → stored as Article (graceful degradation)
│   └── parse custom Comment → stored as Note
│
└── GoToSocial
    ├── parse Person → valid
    └── parse Create(Note) → content stored
```

### 7.3 Live Interop Tests (Docker, Optional)

Use Minifedi or custom Docker Compose to run real instances:

```yaml
# tests/interop/docker-compose.interop.yml
services:
  commonpub:
    build: .
    ports: ["3000:3000"]

  mastodon:
    image: ghcr.io/mastodon/mastodon:latest
    # Mastodon requires postgres, redis, elasticsearch...
    # Complex setup — use Minifedi instead

  gotosocial:
    image: superseriousbusiness/gotosocial:latest
    # Simpler — single binary + sqlite
    environment:
      GTS_HOST: gotosocial.test
      GTS_DB_TYPE: sqlite
    ports: ["8080:8080"]
```

Test: Create user on GoToSocial → follow CommonPub user → publish on CommonPub → appears on GoToSocial.

**Recommendation**: Start with fixture-based tests (7.1–7.2). Add live interop (7.3) when federation is feature-complete.

---

## Security Tests

Cross-cutting concern. Security tests belong at Layers 2–5.

### S1: HTTP Signature Attacks

```
security/http-signatures.test.ts
├── Reject request with no Signature header
├── Reject request with malformed Signature header
├── Reject request with valid signature but wrong body (tampered)
├── Reject request with valid signature but wrong Date (replay)
├── Reject request signed with unknown key
├── Reject request where keyId actor != activity actor (impersonation)
├── Accept request with valid signature
├── Clock skew: reject if Date > 5 minutes old
└── Algorithm: reject non-rsa-sha256 (unless RFC 9421)
```

### S2: SSRF Prevention

```
security/ssrf.test.ts
├── Reject actor URI with private IP (10.x, 172.16-31.x, 192.168.x)
├── Reject actor URI with localhost (127.0.0.1, ::1)
├── Reject actor URI with metadata endpoint (169.254.169.254)
├── Reject actor URI with non-HTTPS in production
├── Reject actor URI with port < 1 or > 65535
├── Accept actor URI with public IP
├── Accept actor URI with valid domain
└── DNS rebinding: re-validate after redirect
```

### S3: Content Injection

```
security/content-injection.test.ts
├── XSS via federated content
│   ├── <script>alert(1)</script> → stripped
│   ├── <img onerror="alert(1)"> → onerror stripped
│   ├── <a href="javascript:alert(1)"> → href stripped
│   ├── <svg onload="alert(1)"> → stripped
│   ├── Nested encoding: &lt;script&gt; → not double-decoded
│   └── Unicode obfuscation → detected and stripped
│
├── XSS via actor profile
│   ├── displayName with HTML → escaped
│   ├── summary with script → sanitized
│   └── avatarUrl with javascript: → rejected
│
├── SQL injection via federation fields
│   ├── actorUri with SQL → parameterized (Drizzle handles)
│   ├── objectUri with SQL → parameterized
│   └── content with SQL → parameterized
│
└── JSONB injection
    ├── payload with __proto__ → ignored
    ├── payload with constructor → ignored
    └── deeply nested payload (>50 levels) → rejected
```

### S4: Denial of Service

```
security/dos.test.ts
├── Extremely large activity payload (>1MB) → rejected
├── Extremely large actor profile → rejected
├── Infinite collection pagination → max page limit enforced
├── Recursive object references → depth limit enforced
├── Activity flood from single domain → rate limited
├── Shared inbox flood → rate limited per-domain
└── WebFinger flood → rate limited
```

### S5: Authorization Boundaries

```
security/authorization.test.ts
├── Non-member posts to private hub → rejected
├── Banned user posts to hub → rejected
├── Activity from blocked instance → rejected before processing
├── Activity from silenced instance → processed but not shown in public feeds
├── Forged actor: activity actor != HTTP Signature actor → rejected
├── Admin-only federation endpoints require auth
└── Mirror config endpoints require admin role
```

---

## CI Integration

### Pipeline Structure

```yaml
# .github/workflows/federation-tests.yml
name: Federation Tests

on:
  push:
    paths:
      - 'packages/protocol/**'
      - 'packages/server/src/federation/**'
      - 'packages/schema/src/federation.ts'
      - 'apps/reference/server/routes/inbox.ts'
      - 'apps/reference/server/routes/users/**'
      - 'tests/federation/**'
      - 'tests/interop/**'
  pull_request:
    branches: [main]

jobs:
  unit-and-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test  # Layers 1-4

  two-instance:
    runs-on: ubuntu-latest
    needs: unit-and-integration
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f deploy/docker-compose.federation-test.yml up -d --wait
      - run: pnpm exec vitest run tests/federation/  # Layer 5
      - run: docker compose -f deploy/docker-compose.federation-test.yml down -v

  interop:
    runs-on: ubuntu-latest
    needs: unit-and-integration
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: pnpm install && pnpm build
      - run: pnpm exec vitest run tests/interop/  # Layer 7.1-7.2 (fixtures only)

  # Weekly: live interop with GoToSocial
  interop-live:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f tests/interop/docker-compose.interop.yml up -d --wait
      - run: pnpm exec vitest run tests/interop/live/
      - run: docker compose -f tests/interop/docker-compose.interop.yml down -v
```

### Test Run Order

```
pnpm test                        # All unit + PGlite integration (Layers 1-3)
pnpm test:federation             # Federation-specific (Layers 3-4)
pnpm test:federation:two-inst    # Two-instance Docker (Layer 5)
pnpm test:federation:interop     # Fixture-based interop (Layer 7.1-7.2)
pnpm test:federation:live        # Live interop (Layer 7.3, optional)
pnpm test:e2e:federation         # Playwright federation E2E (Layer 6)
```

---

## Implementation Order

Aligned with federation-plan.md phases:

### Phase 1 (Outbound Delivery) — Test First

1. Write `signRequest()` unit tests (Layer 2, S1)
2. Write sign→verify roundtrip tests (Layer 2)
3. Write `federation.integration.test.ts` — keypairs, content federation, follow lifecycle (Layer 3)
4. Write `@fedify/testing` flow tests for follow + content delivery (Layer 4)
5. Implement Phase 1
6. Write two-instance follow + delivery tests (Layer 5)
7. Run against real GoToSocial instance (Layer 7.3, optional)

### Phase 2 (Inbound Persistence) — Test First

1. Write `sanitize.test.ts` unit tests (Layer 2, S3)
2. Write `federation-inbound.integration.test.ts` (Layer 3)
3. Write `@fedify/testing` flow tests for publish→deliver→persist (Layer 4)
4. Collect Mastodon/Lemmy fixtures (Layer 7.1)
5. Write fixture parsing tests (Layer 7.2)
6. Implement Phase 2
7. Two-instance content delivery tests (Layer 5)

### Phase 3 (Cross-Instance Interaction) — Test First

1. Write `federation-interaction.integration.test.ts` (Layer 3)
2. Write flow tests for like/comment on remote content (Layer 4)
3. Implement Phase 3
4. Two-instance interaction tests (Layer 5)

### Phase 5 (CommonPub Namespace) — Test First

1. Write `namespace.test.ts` unit tests (Layer 2)
2. Extend `contentMapper.test.ts` for all content types (Layer 2)
3. Write round-trip fidelity tests (Layer 2)
4. Write graceful degradation tests (Layer 2)
5. Implement Phase 5

### Phase 6 (Hub Federation) — Test First

1. Write `hubMapper.test.ts` unit tests (Layer 2)
2. Write `hub-federation.integration.test.ts` (Layer 3)
3. Collect Lemmy Group fixtures (Layer 7.1)
4. Write Lemmy interop parsing tests (Layer 7.2)
5. Write `@fedify/testing` hub flow tests (Layer 4)
6. Implement Phase 6
7. Two-instance hub tests (Layer 5)
8. Playwright hub federation E2E (Layer 6)

### Phase 8 (BOM Federation) — Test First

1. Write `bom-federation.integration.test.ts` (Layer 3)
2. Write `@fedify/testing` BOM flow tests (Layer 4)
3. Implement Phase 8
4. Two-instance BOM tests (Layer 5)

---

## Fixture Collection Strategy

### How to Collect Real Payloads

```bash
# 1. Run a local GoToSocial instance
docker run -p 8080:8080 superseriousbusiness/gotosocial:latest

# 2. Create a test user, follow our test CommonPub instance

# 3. Capture inbound activities with a logging middleware:
# In apps/reference/server/middleware/log-federation.ts
export default defineEventHandler(async (event) => {
  if (event.path.endsWith('/inbox') && event.method === 'POST') {
    const body = await readBody(event);
    console.log('[FEDERATION INBOUND]', JSON.stringify(body, null, 2));
    // Write to tests/interop/fixtures/captured/
  }
});

# 4. Use Fedify CLI to inspect any actor:
npx fedify lookup @user@mastodon.social
npx fedify inbox  # Start ephemeral inbox, get activities POSTed to it
```

### Payload Sources

| Software | Where to Get Fixtures |
|----------|----------------------|
| Mastodon | Run local instance, or `fedify lookup` a public account |
| Lemmy | `join-lemmy.org/docs` has full JSON examples. Or run local instance. |
| Misskey | Run local Misskey/Sharkey instance |
| BookWyrm | `docs.joinbookwyrm.com/activitypub.html` has examples |
| GoToSocial | Easiest to run locally (single binary + SQLite) |

---

## Success Criteria

Federation is "validated" when:

- [ ] All Layer 2 unit tests pass (pure functions)
- [ ] All Layer 3 integration tests pass (PGlite)
- [ ] All Layer 4 flow tests pass (@fedify/testing)
- [ ] All Layer 5 two-instance tests pass (Docker Compose)
- [ ] Fixture-based interop tests pass for Mastodon, Lemmy, GoToSocial
- [ ] Security tests pass (signatures, SSRF, XSS, DoS, authz)
- [ ] Follow flow works across two live instances
- [ ] Content delivery works across two live instances
- [ ] Hub join/post/leave works across two live instances (Phase 6)
- [ ] BOM gallery updates cross-instance (Phase 8)
- [ ] Mastodon user can follow CommonPub user and see articles
- [ ] Lemmy community can interact with CommonPub hub (Phase 6)
- [ ] All tests run in CI with < 5 minute total time (Layers 1–5)
- [ ] Interop tests run weekly (Layer 7)

---

## File Structure Summary

```
commonpub/
├── packages/
│   ├── protocol/src/__tests__/
│   │   ├── namespace.test.ts              # NEW (Phase 5)
│   │   ├── hubMapper.test.ts              # NEW (Phase 6)
│   │   ├── sanitize.test.ts              # NEW (Phase 2)
│   │   ├── httpSignature.test.ts          # EXTEND (Phase 1)
│   │   ├── contentMapper.test.ts          # EXTEND (Phase 5)
│   │   └── activities.test.ts             # EXTEND (Phase 6)
│   │
│   ├── server/src/__tests__/
│   │   ├── federation.integration.test.ts          # NEW (Phase 1)
│   │   ├── federation-inbound.integration.test.ts  # NEW (Phase 2)
│   │   ├── federation-interaction.integration.test.ts # NEW (Phase 3)
│   │   ├── hub-federation.integration.test.ts      # NEW (Phase 6)
│   │   ├── bom-federation.integration.test.ts      # NEW (Phase 8)
│   │   ├── mirror.integration.test.ts              # NEW (Phase 7)
│   │   └── helpers/
│   │       ├── testdb.ts                           # EXISTS
│   │       └── federation-test.ts                  # NEW (Layer 4)
│   │
│   └── test-utils/src/
│       ├── factories.ts                            # EXTEND (federation factories)
│       └── fixtures.ts                             # NEW (fixture loader)
│
├── tests/
│   ├── federation/                                 # NEW (Layer 5)
│   │   ├── setup.ts
│   │   ├── helpers.ts
│   │   ├── webfinger.test.ts
│   │   ├── actor.test.ts
│   │   ├── follow.test.ts
│   │   ├── content-delivery.test.ts
│   │   ├── interaction.test.ts
│   │   ├── hub-federation.test.ts
│   │   ├── bom-federation.test.ts
│   │   ├── mirror.test.ts
│   │   └── sso.test.ts
│   │
│   ├── interop/                                    # NEW (Layer 7)
│   │   ├── fixtures/
│   │   │   ├── mastodon/
│   │   │   ├── lemmy/
│   │   │   ├── misskey/
│   │   │   ├── bookwyrm/
│   │   │   └── gotosocial/
│   │   ├── parse-fixtures.test.ts
│   │   └── docker-compose.interop.yml
│   │
│   └── security/                                   # NEW (cross-cutting)
│       ├── http-signatures.test.ts
│       ├── ssrf.test.ts
│       ├── content-injection.test.ts
│       ├── dos.test.ts
│       └── authorization.test.ts
│
├── e2e/federation/                                 # NEW (Layer 6)
│   ├── follow-remote-user.spec.ts
│   ├── federated-feed.spec.ts
│   ├── hub-federation.spec.ts
│   ├── federation-admin.spec.ts
│   └── sso-login.spec.ts
│
└── deploy/
    ├── docker-compose.federation.yml               # EXISTS
    └── docker-compose.federation-test.yml          # NEW
```

---

## Key Tools & Dependencies

| Tool | Purpose | Layer |
|------|---------|-------|
| Vitest | Test runner | All |
| PGlite (`@electric-sql/pglite`) | In-memory Postgres | 3 |
| `@fedify/testing` | Mock federation (no HTTP) | 4 |
| `fedify inbox` CLI | Manual inbox testing | Development |
| Docker Compose | Two-instance tests | 5 |
| Playwright | Browser E2E | 6 |
| GoToSocial (Docker) | Live interop | 7 |
| DOMPurify (or similar) | HTML sanitization | 2–3 |

### New devDependencies to Add

```json
{
  "@fedify/testing": "^2.0.0",
  "dompurify": "^3.0.0",
  "@types/dompurify": "^3.0.0"
}
```
