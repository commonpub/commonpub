# Federation System Research

## Table of Contents

1. [W3C ActivityPub Specification](#1-w3c-activitypub-specification)
2. [Discovery Protocols](#2-discovery-protocols)
3. [Authentication: HTTP Signatures](#3-authentication-http-signatures)
4. [Fedify Framework](#4-fedify-framework)
5. [Mastodon Federation](#5-mastodon-federation)
6. [Lemmy Federation (Groups/Communities)](#6-lemmy-federation-groupscommunities)
7. [Other Implementations](#7-other-implementations)
8. [FEPs: Fediverse Enhancement Proposals](#8-feps-fediverse-enhancement-proposals)
9. [Relay Servers](#9-relay-servers)
10. [Content Moderation Across Federation](#10-content-moderation-across-federation)
11. [Privacy Implications](#11-privacy-implications)
12. [Common Pitfalls](#12-common-pitfalls)
13. [CommonPub Content Mapping](#13-commonpub-content-mapping)
14. [Architecture Decisions](#14-architecture-decisions)

---

## 1. W3C ActivityPub Specification

**Source:** https://www.w3.org/TR/activitypub/

### Core Concepts

ActivityPub defines two sub-protocols: client-to-server (C2S) and server-to-server (S2S). CommonPub uses S2S federation exclusively.

### JSON-LD Context

All AP objects MUST include:
```json
{ "@context": "https://www.w3.org/ns/activitystreams" }
```

Content types for S2S:
- POST requests: `Content-Type: application/ld+json; profile="https://www.w3.org/ns/activitystreams"`
- GET requests: `Accept: application/ld+json; profile="https://www.w3.org/ns/activitystreams"`
- `application/activity+json` is treated as equivalent by most implementations

### Actor Structure

Actors are the fundamental entities. Required properties:

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Person",
  "id": "https://example.com/users/alice",
  "inbox": "https://example.com/users/alice/inbox",
  "outbox": "https://example.com/users/alice/outbox",
  "following": "https://example.com/users/alice/following",
  "followers": "https://example.com/users/alice/followers",
  "liked": "https://example.com/users/alice/liked",
  "preferredUsername": "alice",
  "endpoints": {
    "sharedInbox": "https://example.com/inbox"
  }
}
```

Actor types: `Person`, `Group`, `Organization`, `Application`, `Service`

### Public Addressing

The special collection URI: `https://www.w3.org/ns/activitystreams#Public`

Visibility patterns (de facto standard from Mastodon):
| Visibility | `to` | `cc` |
|---|---|---|
| Public | `as:Public` | followers collection |
| Unlisted | followers collection | `as:Public` |
| Followers-only | followers collection | (none) |
| Direct | mentioned actors only | (none) |

### Delivery Mechanism (Section 7.1)

1. Collect recipients from `to`, `bto`, `cc`, `bcc`, `audience` fields
2. Dereference collection recipients to discover individual inboxes
3. De-duplicate the final recipient list
4. Exclude the activity's own actor
5. Remove `bto` and `bcc` before delivery (but use for targeting)
6. POST to each recipient's inbox
7. Delivery SHOULD be asynchronous with retry on failure

### Shared Inbox Optimization (Section 7.1.3)

When multiple recipients share a `sharedInbox`, the server MAY deliver once to that shared endpoint instead of each individual inbox. This is critical for efficiency when broadcasting to many followers on the same instance.

### Activity Side Effects

| Activity | Server Side Effect |
|---|---|
| `Create` | Store object locally |
| `Update` | Replace stored object (MUST verify same origin as original) |
| `Delete` | Remove object, MAY replace with `Tombstone` (return 410 Gone) |
| `Follow` | Server SHOULD generate `Accept` or `Reject` |
| `Accept` (Follow) | Add actor to Following collection |
| `Reject` (Follow) | MUST NOT add to Following collection |
| `Like` | Increment object's likes collection |
| `Announce` | Increment object's shares collection (boost/reblog) |
| `Undo` | Reverse side effects of previous activity (actor must match) |
| `Add` | Add object to target collection |
| `Remove` | Remove object from target collection |

### Inbox Forwarding (Section 7.1.2)

Solves the "ghost replies" problem. A server SHOULD forward received activities when:
1. This is the first time the server has seen the activity
2. Values in `to`, `cc`, or `audience` contain a collection owned by the server
3. Values in `inReplyTo`, `object`, `target`, or `tag` reference server-owned objects

MUST only forward to `to`/`cc`/`audience` of the original object, not new addressees discovered during recursion.

### Tombstone Object

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "id": "https://example.com/content/deleted-slug",
  "type": "Tombstone",
  "formerType": "Article",
  "published": "2024-01-01T00:00:00Z",
  "deleted": "2024-01-02T00:00:00Z"
}
```

---

## 2. Discovery Protocols

### WebFinger (RFC 7033)

**Sources:** https://docs.joinmastodon.org/spec/webfinger/, https://www.w3.org/community/reports/socialcg/CG-FINAL-apwf-20240608/

**Endpoint:** `GET /.well-known/webfinger?resource=acct:username@domain`

**Response format:** JSON Resource Descriptor (JRD), content type `application/jrd+json`

```json
{
  "subject": "acct:alice@social.example",
  "aliases": [
    "https://social.example/@alice",
    "https://social.example/users/alice"
  ],
  "links": [
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "https://social.example/@alice"
    },
    {
      "rel": "self",
      "type": "application/activity+json",
      "href": "https://social.example/users/alice"
    },
    {
      "rel": "http://ostatus.org/schema/1.0/subscribe",
      "template": "https://social.example/authorize_interaction?uri={uri}"
    }
  ]
}
```

**Required link:** `rel="self"` with `type` of either `application/activity+json` or `application/ld+json; profile="https://www.w3.org/ns/activitystreams"`.

**Reverse discovery** (Actor to username): Extract hostname from actor `id`, combine with `preferredUsername`, then verify via forward WebFinger lookup.

**Username rules (de facto from Mastodon):** Alphanumeric and underscores anywhere, dashes and periods only in the middle. Case-insensitive locally. Regex: `[a-z0-9_]+([a-z0-9_.-]+[a-z0-9_]+)?`

### NodeInfo 2.1

**Sources:** https://nodeinfo.diaspora.software/protocol.html, https://github.com/jhass/nodeinfo/blob/main/schemas/2.1/schema.json

**Discovery endpoint:** `GET /.well-known/nodeinfo` returns JRD with link to schema document.

```json
{
  "links": [{
    "rel": "http://nodeinfo.diaspora.software/ns/schema/2.1",
    "href": "https://example.com/nodeinfo/2.1"
  }]
}
```

**NodeInfo 2.1 schema (all required):**

```json
{
  "version": "2.1",
  "software": {
    "name": "commonpub",
    "version": "1.0.0",
    "repository": "https://github.com/commonpub/commonpub",
    "homepage": "https://commonpub.org"
  },
  "protocols": ["activitypub"],
  "services": {
    "inbound": [],
    "outbound": ["atom1.0", "rss2.0"]
  },
  "openRegistrations": true,
  "usage": {
    "users": {
      "total": 100,
      "activeHalfyear": 50,
      "activeMonth": 20
    },
    "localPosts": 1000,
    "localComments": 2000
  },
  "metadata": {}
}
```

**`software.name` constraint:** must match `/^[a-z0-9-]+$/`

**`protocols` enum values:** `activitypub`, `buddycloud`, `dfrn`, `diaspora`, `libertree`, `ostatus`, `pumpio`, `tent`, `xmpp`, `zot`

**`metadata`** is a free-form object for software-specific values. CommonPub can use this to advertise supported content types, hub types, feature flags, etc.

---

## 3. Authentication: HTTP Signatures

**Source:** https://swicg.github.io/activitypub-http-signature/

### Two Competing Standards

1. **draft-cavage-http-signatures-12** -- Expired individual draft, never standardized, but the de facto fediverse standard
2. **RFC 9421 (HTTP Message Signatures)** -- The final IETF standard, complete redesign with signed metadata

Key difference: In draft-cavage, algorithm and key identifier are NOT part of signed data (vulnerable to alteration). RFC 9421 signs the metadata too.

### Signing Process (draft-cavage-12)

1. Generate RSA-2048+ keypair (Ed25519 gaining adoption but limited support)
2. Compute SHA-256 hash of request body, base64-encode, prefix with `SHA-256=` for `Digest` header
3. Construct signature string from headers: `(request-target)`, `host`, `date`, `content-type`, `digest`
4. Sign with private key using `rsa-sha256` (reported as `hs2019` algorithm)
5. Place in `Signature` HTTP header with `keyId`, `algorithm`, `headers`, `signature` fields

### Signature Header Format

```
Signature: keyId="https://example.com/users/alice#main-key",
           algorithm="hs2019",
           headers="(request-target) host date digest content-type",
           signature="base64-encoded-signature"
```

### Verification Process

1. Extract `keyId` from `Signature` header
2. Fetch the actor document at that URL
3. Extract public key from actor's `publicKey.publicKeyPem`
4. Verify the signature against the signed headers
5. On failure with cached key, re-fetch actor (handles key rotation)
6. Validate `Date` header is within ~1 hour of current time

### Double-Knocking Strategy (Fedify)

Fedify implements "double-knocking": attempt with one signature version, if rejected retry with the other. Remembers which version each remote server accepts (cached in KV store).

### Authorized Fetch (Secure Mode)

Some servers require HTTP Signatures on ALL requests (including GET). This enables:
- Blocking specific server domains from accessing any content
- Limited/allowlist federation
- Privacy-oriented instances

Requires an "instance actor" to break infinite key-fetch loops.

### Key Gotchas

1. `Digest` header required for POST requests
2. `Date` header must be within ~1 hour (some implementations stricter at ~30 seconds)
3. Key rotation: old keys must remain valid briefly; re-fetch on verification failure
4. `keyId` format convention: `https://domain/users/username#main-key`
5. All header names in signature string must be lowercase
6. RSA-PKCS#1-v1.5 required for broadest compatibility; Ed25519 for Object Integrity Proofs

---

## 4. Fedify Framework

**Sources:** https://fedify.dev/manual/federation, https://fedify.dev/manual/actor, https://fedify.dev/manual/inbox, https://fedify.dev/manual/send

### Federation Setup

```typescript
import { createFederation } from "@fedify/fedify";
import { PostgresKvStore, PostgresMessageQueue } from "@fedify/postgres";

const federation = createFederation<AppContext>({
  kv: new PostgresKvStore(pool),               // Required: cache + state
  queue: {                                       // Recommended: async delivery
    inbox: new PostgresMessageQueue(pool),
    outbox: new PostgresMessageQueue(pool),
  },
  // Origin can decouple WebFinger host from server host
  origin: {
    handleHost: "example.com",                   // WebFinger domain
    webOrigin: "https://ap.example.com",         // AP server origin
  },
  // Signature configuration
  firstKnock: "rfc9421",                         // Try RFC 9421 first, fallback to cavage
  // Retry configuration
  outboxRetryPolicy: createExponentialBackoffRetryPolicy({
    maxRetries: 10,
    maxDuration: Temporal.Duration.from({ hours: 12 }),
  }),
});
```

### Actor Dispatcher

```typescript
federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    const user = await db.getUser(identifier);
    if (!user) return null;

    const keys = await ctx.getActorKeyPairs(identifier);
    return new Person({
      id: ctx.getActorUri(identifier),
      preferredUsername: user.username,
      name: user.displayName,
      summary: user.bio,
      inbox: ctx.getInboxUri(identifier),
      outbox: ctx.getOutboxUri(identifier),
      followers: ctx.getFollowersUri(identifier),
      following: ctx.getFollowingUri(identifier),
      endpoints: new Endpoints({
        sharedInbox: ctx.getInboxUri(),  // No identifier = shared inbox
      }),
      publicKey: keys[0].cryptographicKey,       // RSA key
      assertionMethods: keys.map(k => k.multikey), // Ed25519 keys
    });
  })
  // Decouple WebFinger username from internal identifier (e.g., UUID)
  .mapHandle(async (ctx, username) => {
    const user = await db.getUserByUsername(username);
    return user?.id ?? null;
  })
  .setKeyPairsDispatcher(async (ctx, identifier) => {
    const keys = await db.getKeypairs(identifier);
    return [
      {
        privateKey: await importJwk(keys.rsaPrivate, "private"),
        publicKey: await importJwk(keys.rsaPublic, "public"),
      },
      {
        privateKey: await importJwk(keys.ed25519Private, "private"),
        publicKey: await importJwk(keys.ed25519Public, "public"),
      },
    ];
  });
```

**Supported actor types:** `Person`, `Group`, `Organization`, `Application`, `Service`

### Inbox Listeners

```typescript
federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")  // personal, shared
  .on(Follow, async (ctx, follow) => {
    if (follow.objectId == null) return;
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") return;
    const follower = await follow.getActor(ctx);
    if (follower == null) return;
    // Store follower in database
    await db.addFollower(parsed.identifier, follower);
    // Send Accept back
    await ctx.sendActivity(
      { identifier: parsed.identifier },
      follower,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  })
  .on(Create, async (ctx, create) => {
    const recipient = ctx.recipient; // null for shared inbox
    const object = await create.getObject();
    // Process the created object
  })
  .on(Undo, async (ctx, undo) => {
    const inner = await undo.getObject();
    if (inner instanceof Follow) {
      // Remove follower
    }
  })
  .onError(async (ctx, error) => {
    console.error("Inbox error:", error);
  });
```

**Key behaviors:**
- Activities of unregistered types are silently ignored
- Unsigned activities and invalid signatures are silently ignored
- `ctx.recipient` is the actor identifier for personal inbox, `null` for shared inbox
- Activity idempotency: configurable as `"per-inbox"` (default), `"per-origin"`, or `"global"`

### Sending Activities

```typescript
// Send to specific actor
await ctx.sendActivity(
  { identifier: senderId },
  recipientActor,
  new Create({
    id: new URL(`#create`, objectUri),
    actor: ctx.getActorUri(senderId),
    object: new Note({
      id: objectUri,
      attribution: ctx.getActorUri(senderId),
      to: PUBLIC_COLLECTION,
      cc: ctx.getFollowersUri(senderId),
      content: "Hello fediverse!",
    }),
  }),
);

// Send to all followers (requires followers collection dispatcher)
await ctx.sendActivity(
  { identifier: senderId },
  "followers",
  activity,
  { preferSharedInbox: true },
);
```

**Delivery options:**
- `preferSharedInbox: true` -- Use shared inbox when available (fewer HTTP requests)
- `fanout: "auto"` -- Two-stage delivery for large follower counts
- `orderingKey: noteId.href` -- Guarantee sequential delivery for related activities
- `excludeBaseUris: [ctx.getInboxUri()]` -- Exclude same-server recipients
- `immediate: true` -- Bypass queue, send synchronously
- `syncCollection: true` -- Include followers digest (FEP-8fcf)

### Activity Forwarding

```typescript
// Forward activity to followers preserving original signature
await ctx.forwardActivity(
  { identifier: forwarderId },
  "followers",
  { skipIfUnsigned: true },
);
```

### Permanent Failure Handling

```typescript
federation.setOutboxPermanentFailureHandler(async (ctx, values) => {
  // values.statusCode (404 or 410)
  // values.inbox (the failing inbox URL)
  // values.actorIds (actors at that inbox)
  await db.removeFollower(values.actorIds[0]);
});
```

### NodeInfo Dispatcher

```typescript
federation.setNodeInfoDispatcher("/nodeinfo/2.1", async (ctx) => {
  const stats = await db.getInstanceStats();
  return {
    software: {
      name: "commonpub",
      version: { major: 1, minor: 0, patch: 0 },
      homepage: new URL("https://commonpub.org/"),
      repository: new URL("https://github.com/commonpub/commonpub"),
    },
    protocols: ["activitypub"],
    usage: {
      users: {
        total: stats.totalUsers,
        activeHalfyear: stats.activeHalfyear,
        activeMonth: stats.activeMonth,
      },
      localPosts: stats.localPosts,
      localComments: stats.localComments,
    },
  };
});
```

### Cryptographic Signing (Automatic)

Fedify signs outgoing activities with up to four mechanisms simultaneously:
1. **HTTP Signatures (draft-cavage-12)** -- Uses first RSA key pair
2. **HTTP Message Signatures (RFC 9421)** -- Preferred, fallback to cavage
3. **Linked Data Signatures** -- Obsolete but still widely required
4. **Object Integrity Proofs (FEP-8b32)** -- Modern, requires Ed25519 keys

### Fedify 2.0 Features

- **Modular architecture** with `FederationBuilder` for deferred instantiation
- **Debug dashboard** for real-time ActivityPub inspection
- **Relay support** via `@fedify/relay` package
- **Ordered message delivery** via `orderingKey`
- **Permanent failure handling** for dead inboxes
- **Activity transformers** for recipient-specific modifications
- **Separate inbox/outbox queues**

---

## 5. Mastodon Federation

**Source:** https://docs.joinmastodon.org/spec/activitypub/

### Supported Object Types

| Object Type | Mastodon Rendering |
|---|---|
| `Note` | Regular status |
| `Question` | Poll |
| `Article`, `Page`, `Image`, `Audio`, `Video`, `Event` | Status using `content` (or `name` if no content) |

### JSON-LD Namespaces

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1",
    {
      "toot": "http://joinmastodon.org/ns#",
      "schema": "http://schema.org/",
      "Hashtag": "as:Hashtag",
      "sensitive": "as:sensitive",
      "manuallyApprovesFollowers": "as:manuallyApprovesFollowers",
      "movedTo": "as:movedTo",
      "Emoji": "toot:Emoji",
      "featured": "toot:featured",
      "featuredTags": "toot:featuredTags",
      "discoverable": "toot:discoverable",
      "indexable": "toot:indexable",
      "focalPoint": "toot:focalPoint",
      "blurhash": "toot:blurhash",
      "votersCount": "toot:votersCount",
      "suspended": "toot:suspended",
      "memorial": "toot:memorial",
      "PropertyValue": "schema:PropertyValue",
      "value": "schema:value"
    }
  ]
}
```

### Mastodon Extensions

- `toot:discoverable` (boolean) -- opt-in to directory/external discovery
- `toot:indexable` (boolean) -- opt-in to full-text search indexing
- `toot:featured` -- pinned posts collection
- `toot:featuredTags` -- featured hashtags collection
- `toot:blurhash` -- image placeholder hash
- `toot:focalPoint` -- crop guidance `[x, y]` floats from -1.0 to 1.0
- `toot:votersCount` -- total poll participants
- `as:sensitive` -- content warning flag
- `summary` -- used as content warning text (CW spoiler)

### Visibility Calculation

Mastodon determines visibility from addressing:
- **public**: `as:Public` in `to`
- **unlisted**: `as:Public` in `cc`
- **private**: Followers collection in `to`/`cc`, no `as:Public`
- **limited**: Actors in `to`/`cc` with non-Mention targets
- **direct**: All recipients are Mention-tagged actors

### HTML Sanitization

Allowed elements (v4.2+): `<p>`, `<span>`, `<br>`, `<a>`, `<del>`, `<pre>`, `<code>`, `<em>`, `<strong>`, `<b>`, `<i>`, `<u>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`. Headings are converted to `<strong>` in `<p>`.

**Implication for CommonPub:** Rich article content will be stripped down to basic HTML when viewed in Mastodon. Must design content with graceful degradation.

### Quote Posts (v4.5+)

Implements FEP-044f. Only the first quote per post is accepted. Also understands `quoteUri`, `quoteUrl`, `_misskey_quote` for backward compatibility.

### Follower Synchronization

Uses `Collection-Synchronization` HTTP header with:
- `collectionId`: Sender's followers collection
- `url`: Partial collection with instance-specific followers
- `digest`: XOR of SHA256 hashes of follower identifiers

### Secure Mode

All cross-server HTTP requests must be signed (GET and POST). Foundation for limited/allowlist federation.

### Moderation Activities

- `Flag` -- Federated reports (from instance actor, includes reported content URIs and `content` for comment)
- `Block` -- Signal remote server to hide profile
- `Move` -- Account migration (requires `alsoKnownAs` verification on target)

---

## 6. Lemmy Federation (Groups/Communities)

**Source:** https://join-lemmy.org/docs/contributors/05-federation.html

This is the most relevant prior art for CommonPub's "hub" concept.

### Entity Mapping

| Lemmy Entity | AP Type | Notes |
|---|---|---|
| Community | `Group` | Automated actor that announces content to followers |
| User | `Person` | Standard AP actor |
| Post | `Page` | NOT `Article` -- uses `name` for title |
| Comment | `Note` | With `inReplyTo` chain |

### Community Actor (Group)

```json
{
  "@context": ["https://join-lemmy.org/context.json", "https://www.w3.org/ns/activitystreams"],
  "type": "Group",
  "id": "https://instance.com/c/makers",
  "preferredUsername": "makers",
  "name": "Maker Community",
  "summary": "<p>A community for makers</p>",
  "source": { "content": "A community for makers", "mediaType": "text/markdown" },
  "inbox": "https://instance.com/c/makers/inbox",
  "followers": "https://instance.com/c/makers/followers",
  "attributedTo": "https://instance.com/c/makers/moderators",
  "featured": "https://instance.com/c/makers/featured",
  "postingRestrictedToMods": false,
  "publicKey": { "id": "...", "owner": "...", "publicKeyPem": "..." }
}
```

### The Announce Pattern

This is how Lemmy distributes community content. The flow:

1. User on Instance A creates a post addressed to Community on Instance B
2. Community inbox receives `Create/Page` activity
3. Community wraps the ENTIRE activity in an `Announce` and sends to all followers
4. All followers (across all instances) receive the content

```json
{
  "actor": "https://instance.com/c/makers",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "object": {
    "type": "Create",
    "actor": "https://other-instance.com/u/alice",
    "object": { "type": "Page", "..." : "..." }
  },
  "cc": ["https://instance.com/c/makers/followers"],
  "type": "Announce",
  "id": "https://instance.com/activities/announce/uuid"
}
```

**Key:** The community Announces the full Create **activity**, not just the object. This preserves the original author attribution. Some implementations (non-1b12) Announce only the object, which is less correct.

### Post (Page) Structure

```json
{
  "type": "Page",
  "attributedTo": "https://instance.com/u/alice",
  "to": ["https://instance.com/c/makers", "https://www.w3.org/ns/activitystreams#Public"],
  "audience": "https://instance.com/c/makers",
  "name": "My Cool Project",
  "content": "<p>HTML body</p>",
  "source": { "content": "Markdown body", "mediaType": "text/markdown" },
  "attachment": [{ "type": "Link", "href": "https://example.com/project" }],
  "sensitive": false,
  "published": "2024-01-01T00:00:00Z"
}
```

The `audience` property identifies which community the post belongs to.

### Comment (Note) Structure

```json
{
  "type": "Note",
  "attributedTo": "https://instance.com/u/bob",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://instance.com/c/makers", "https://instance.com/u/alice"],
  "audience": "https://instance.com/c/makers",
  "inReplyTo": "https://instance.com/post/123",
  "content": "<p>Great project!</p>",
  "tag": [{ "href": "https://instance.com/u/alice", "type": "Mention" }]
}
```

### Voting (Like/Dislike)

```json
{
  "actor": "https://instance.com/u/alice",
  "object": "https://instance.com/post/123",
  "audience": "https://instance.com/c/makers",
  "type": "Like",
  "id": "https://instance.com/activities/like/uuid"
}
```

Downvotes use `Dislike` type. Both reversible via `Undo`.

### Moderation Activities

```json
// Remove content (mod action)
{
  "actor": "https://instance.com/u/mod",
  "object": "https://instance.com/post/456",
  "type": "Delete",
  "summary": "Rule violation: spam",
  "cc": ["https://instance.com/c/makers"]
}

// Ban user from community
{
  "actor": "https://instance.com/u/mod",
  "object": "https://other-instance.com/u/spammer",
  "target": "https://instance.com/c/makers",
  "type": "Block",
  "removeData": true,
  "summary": "Spam",
  "expires": "2024-06-01T00:00:00Z"
}

// Add moderator
{
  "actor": "https://instance.com/u/admin",
  "object": "https://instance.com/u/newmod",
  "target": "https://instance.com/c/makers/moderators",
  "type": "Add"
}

// Lock post (prevent replies)
{
  "actor": "https://instance.com/u/mod",
  "object": "https://instance.com/post/789",
  "type": "Lock",
  "cc": ["https://instance.com/c/makers"]
}

// Pin post
{
  "actor": "https://instance.com/u/mod",
  "object": "https://instance.com/post/100",
  "target": "https://instance.com/c/makers/featured",
  "type": "Add"
}
```

### Community Follow

```json
{
  "actor": "https://other-instance.com/u/alice",
  "to": ["https://instance.com/c/makers"],
  "object": "https://instance.com/c/makers",
  "type": "Follow"
}
```

Community auto-accepts and responds with `Accept/Follow`.

---

## 7. Other Implementations

### PeerTube (Video)

**Source:** https://docs.joinpeertube.org/api/activitypub

- **Channels as Group actors**, owned by Person accounts
- Video published: Account sends `Create`, Channel sends `Announce`
- **Video object type** with custom `pt:` namespace extensions:
  - `duration` (ISO 8601), `views`, `downloads`
  - `url` array with multiple resolutions and formats (MP4, HLS, torrent, magnet)
  - `icon` array for thumbnails, `preview` with storyboard data
  - `canReply` for comment control (set to `as:Public` or `null`)
  - `isLiveBroadcast`, `permanentLive`, `latencyMode` for livestreaming
  - `hasParts` for video chapters
- **View activity** for audience tracking with `expires` attribute
- **ApproveReply** activity (FEP-5624) for comment moderation
- **CacheFile** objects for distributed caching / WebSeed support
- **Playlists** as `OrderedCollectionPage` with `PlaylistElement` items

### BookWyrm (Books)

**Source:** https://docs.joinbookwyrm.com/activitypub.html

- Three custom status types: `Review`, `Comment`, `Quotation`
  - `Review` has `inReplyToBook`, title, body, numerical rating (0-5)
  - For non-BookWyrm instances: Reviews become `Article`, Comments/Quotations become `Note`
- **Shelf** collections: `to-read`, `reading`, `stop-reading`, `read` (per-user `OrderedCollection`)
- **List** collections: collaborative book lists
- `Add`/`Remove` activities manage collection membership

### Pixelfed (Photos)

**Source:** https://docs.pixelfed.org/spec/ActivityPub.html

- Posts as `Note` with `Image` type attachments
- `toot:blurhash` for image previews
- `capabilities` object for ACL: `announce`, `like`, `reply` set to `as:Public` or `null`
- `location` with `Place` type (name, longitude, latitude, country)
- Stories federate via `Add` activity with Bearcaps (Pixelfed-to-Pixelfed only)
- Supports FEP-400e and FEP-1b12 for federated groups

### Funkwhale (Audio/Music)

**Source:** https://docs.funkwhale.audio/developer/federation/index.html

Custom object types in Funkwhale namespace:
- **`Artist`**: name, musicbrainzId (UUID)
- **`Album`**: name, artists array, released date, cover Link, musicbrainzId
- **`Track`**: name, position (integer), album, artists array, musicbrainzId
- **`Library`**: Actor/Collection hybrid, `attributedTo` owner, `totalItems`, paginated
- **`Audio`**: size (bytes), bitrate, duration (seconds), library URI, track reference

**Access control model:** Public libraries accessible without restriction. Restricted libraries require HTTP request signed by actor with an approved `Follow`. Follow approval is manual for restricted libraries, automatic for public.

**Service actor:** Pod-level actor authoritative for all domain objects. Can authenticate fetches and send messages.

### Owncast (Livestreaming)

- Written in Go, optional ActivityPub integration
- Server acts as a single `Service` actor
- Sends `Create/Note` when stream goes live (notification post)
- Followers on Mastodon/etc. see notification with stream link
- No video content federation -- only notification activities

### Misskey/Sharkey

**Namespace:** `https://misskey-hub.net/ns#`

Key extensions:
- `_misskey_content` (deprecated) -- MFM markdown source
- `_misskey_quote` -- Quote post reference (AP id of quoted note)
- `_misskey_reaction` -- Custom emoji/Unicode reaction on `Like` activities
- `_misskey_votes` -- Vote count per poll option on `Question`
- `_misskey_talk` -- Boolean marking chat messages
- `isCat` -- Boolean indicating actor "identifies as a cat" (client effects)

### Akkoma/Pleroma

**Source:** https://docs.akkoma.dev/stable/development/ap_extensions/

- `EmojiReact` custom activity type (multiple reactions per post, one per emoji per user)
- `quoteUri` for quote posts (compatible with Misskey's `_misskey_quote`)
- `context` property for threading (all posts with same `context` are one thread)
- `source` property with `mediaType`: `text/plain`, `text/markdown`, `text/bbcode`, `text/x.misskeymarkdown`
- `contentMap` with ISO 639-1 language codes for multilingual posts
- Local-only posts: `<instance_base_url>/#Public` in `to` instead of `as:Public`
- `backgroundUrl` using Sharkey namespace for profile backgrounds

### GoToSocial

- Written in Go, still in beta (expected to exit beta ~2026)
- Aims for Mastodon compatibility as baseline
- Groups/group posting planned but not yet implemented
- Interaction controls (per-post reply policies) in development
- Authorized fetch support
- Generic AP backend without integrated frontend

### Manyfold (3D Models)

**Source:** https://manyfold.app/technology/activitypub.html

Most relevant for CommonPub's structured content approach:
- Custom `f3di` namespace (`http://purl.org/f3di/ns#`) for 3D content
- **`concreteType`** property to distinguish domain-specific objects while using standard AP types
- **Dual-activity strategy**: For each domain object activity, simultaneously sends a `Note` with `f3di:compatibilityNote: true` for Mastodon compatibility
- 3DModel represented as `Service` actor type, Creator as `Person`, Collection as `Group`
- SPDX licensing in attachments
- Plans to use NodeInfo to filter activities by server capability

---

## 8. FEPs: Fediverse Enhancement Proposals

**Source:** https://codeberg.org/fediverse/fep

### FEP-1b12: Group Federation

**Status:** Widely implemented (~2/3 of group implementations)

Defines how `Group` actors federate content:
1. User sends activity (e.g., `Create/Page`) to Group inbox
2. Group wraps the entire activity in `Announce` and sends to all followers
3. Group uses `audience` property to identify itself on content
4. `attributedTo` on Group points to moderator collection

The key distinction: FEP-1b12 Announces the **activity**, not just the object. This preserves attribution and allows followers to process the full context.

NodeBB implements FEP-1b12 for forum categories -- each category is a `Group` actor that Announces content to followers. Remote users can post by addressing `@category-name@domain`.

### FEP-400e: Publicly-Appendable Collections

**Status:** Finalized (Feb 2022), ~1/3 of group implementations

Enables external actors to contribute to collections owned by others (walls, forums, albums):

1. External actor sends `Create` with `target` field referencing collection
2. Owner server validates, stores object, sends `Add` activity to followers
3. Owner has complete authority to `Delete` or `Move` objects

```json
// Object with target collection
{
  "type": "Note",
  "content": "Posted to group wall",
  "target": {
    "type": "OrderedCollection",
    "id": "https://example.com/groups/5/wall",
    "attributedTo": "https://example.com/groups/5"
  }
}

// Owner's Add notification to followers
{
  "actor": "https://example.com/groups/5",
  "type": "Add",
  "object": "https://example.com/posts/41864",
  "target": "https://example.com/groups/5/wall",
  "to": ["as:Public", "https://example.com/groups/5/followers"]
}
```

Supports delayed moderation -- server can defer `Add` pending human approval, send `Reject{Create}` if rejected.

### FEP-8b32: Object Integrity Proofs

Self-authenticating activities using Ed25519 signatures. Uses JCS (RFC 8785) for deterministic JSON serialization. Enables verification without refetching from origin -- critical for inbox forwarding and relay scenarios.

### FEP-044f: Quote Posts

Defines quote post mechanics with user consent framework. Mastodon v4.5+ implements this. Includes `QuoteRequest` activity for approval flow.

### FEP-5624: Per-Object Reply Control

Allows setting reply policies per object. PeerTube uses `ApproveReply` activity for moderated comments. GoToSocial developing interaction controls.

### FEP-d36d: Sharing Content Across Federated Forums

Addresses cross-posting between forum instances (threadiverse). When multiple instances seed similar communities, this FEP defines how to share content between them.

### Reconciling FEP-400e and FEP-1b12

Active discussion on how to combine both approaches. FEP-1b12 (Announce pattern) is more widely adopted. FEP-400e (appendable collections) is more flexible. CommonPub should support both consumption patterns.

---

## 9. Relay Servers

**Sources:** https://socialhub.activitypub.rocks/t/fediverse-relays/4626, https://github.com/fedify-dev/fedify/discussions/580

### What Relays Do

Relays solve discoverability for small instances by forwarding public content between subscribed servers without requiring individual follow relationships.

### Subscription Protocol

Instance subscribes by sending `Follow` to relay inbox:
```json
{
  "type": "Follow",
  "actor": "https://server.example/actor",
  "object": "https://www.w3.org/ns/activitystreams#Public"
}
```

The `object` targets `as:Public` (not a specific actor). Relay responds with `Accept`.

### Two Relay Protocols

**Mastodon Relay Protocol:**
- Uses `Follow` to `as:Public` pattern
- Requires LD Signatures for verification
- Activities forwarded to subscriber `sharedInbox` endpoints
- Widely supported

**LitePub/Pleroma Protocol:**
- Requests actor document IRI instead of inbox
- Uses `Announce` wrappers for compatibility
- More accessible to non-admin users

### Activity Forwarding Modes

1. **Direct forwarding:** `Update`, `Delete`, `Undo`, `Move`, `Like`, `Add`, `Remove` posted directly to subscribers unmodified
2. **Relay Announce:** `Create` and `Announce` activities wrapped in relay-initiated `Announce` (boosts through relay actor)

Constraints: Activity must be published within last 30 minutes and not previously processed.

### Fedify Relay Package (`@fedify/relay`)

```typescript
import { MastodonRelay } from "@fedify/relay";

const relay = new MastodonRelay({
  kv: new PostgresKvStore(pool),
  domain: "relay.example.com",
  onSubscribe: async (actor) => {
    // Return true to accept, false to reject
    return !blocklist.includes(actor.origin);
  },
});
```

### Implications for CommonPub

Relays are useful for populating federated timelines but replicate ALL public content from subscribed servers. CommonPub should:
- Support relay subscription (admin feature)
- Consider topic-based relays (only forward content with specific tags)
- Implement content filtering on relay consumption

---

## 10. Content Moderation Across Federation

**Sources:** https://www.techpolicy.press/, https://carnegieendowment.org/research/2025/03/

### Available Tools

1. **Instance-level blocking (defederation):** Complete cut-off from another instance. No content delivery in either direction.
2. **Instance-level silencing:** Content from silenced instance hidden from public timelines but still accessible via direct follows.
3. **Individual user blocking:** `Block` activity prevents content delivery to/from specific user.
4. **Federated reports:** `Flag` activity sends moderation reports to remote instance admins.
5. **Blocklist subscriptions:** Community-maintained lists (e.g., IFTAS DNI list) with scheduled syncing.

### Defederation

- Not "removal" from the fediverse -- only per-instance decision
- Each instance operator independently decides federation policy
- Over 800 servers preemptively defederated from Threads (Fedipact)
- Can be allowlist (federate only with approved) or denylist (block specific instances)

### Moderation Activity Patterns

```json
// Federated report
{
  "type": "Flag",
  "actor": "https://instance.com/actor",
  "object": ["https://remote.com/u/spammer", "https://remote.com/post/123"],
  "content": "This user is posting spam"
}

// Block user
{
  "type": "Block",
  "actor": "https://instance.com/u/alice",
  "object": "https://remote.com/u/troll"
}
```

### Key Challenges

- Cannot remove all copies of content across all instances once federated
- No centralized governance or enforcement mechanism
- Conflicting instance policies create edge cases
- Reporting mechanisms are burdensome for users
- Small instances may lack moderation capacity
- Content that's acceptable on one instance may violate another's rules

### Best Practices

1. Clear, published instance policies
2. Transparent moderation tooling and processes
3. Guidance documents for moderators
4. Subscribe to community-maintained blocklists
5. Implement rate limiting on federation endpoints
6. Allow configurable moderation policies per hub/community
7. Support delegated moderation within communities

---

## 11. Privacy Implications

### Data Sovereignty Concerns

- Instance admins can see all user activity, messages, and browsing
- Once content is federated, the originating server loses control over copies
- Deleting content sends `Delete` activity but remote servers may ignore it
- `Tombstone` objects may or may not be respected

### Selective Federation Models

**Open federation (default):** Federate with everyone, denylist problematic instances.

**Allowlist federation:** Only federate with explicitly approved instances. Better for privacy-focused communities. Mastodon's "secure mode" + limited federation enables this.

**Per-content federation:** Not natively supported by AP but can be implemented:
- Use followers-only visibility
- Use direct messages for private content
- Implement authorized fetch to control who can access content
- Use `manuallyApprovesFollowers: true` for gated communities

### Implications for CommonPub

- CommonPub hubs should support per-hub federation policies
- Private hubs should not federate content by default
- Products and pricing data need careful federation controls
- Learning progress/completion data should NEVER federate
- User activity data should be federation-opt-in

---

## 12. Common Pitfalls

**Sources:** https://overengineer.dev/blog/2019/01/13/activitypub-final-thoughts-one-year-later/, various implementation documentation

### Specification Ambiguity

- No required attributes defined for object types -- implementations disagree on what's mandatory
- Extensions aren't catalogued or versioned -- no way to discover what features a remote server supports
- Knowledge is fragmented across bug trackers, source code, and developer chats rather than spec documents
- "Compatible with other implementations" claims are misleading -- interop is partial at best

### Interoperability Failures

- **Silent rejection:** Mastodon silently rejects `Update` activities unless `updated` timestamp changes
- **Privacy leaks:** New implementations have accidentally displayed Mastodon-style DMs publicly
- **Content stripping:** Rich HTML content degraded to basic text in microblogging platforms
- **Unintentional DDoS:** Every instance downloading OpenGraph previews simultaneously can overwhelm origin servers
- **Recursive resolution:** Unbounded object resolution creates DoS vectors

### Authentication Gaps

- ActivityPub has NO built-in authentication
- HTTP Signatures are a convention, not spec-required
- Anyone could theoretically forge activities without signature verification
- Account migration is limited (basic follower migration only, no content migration)

### Testing Challenges

- Most implementers test only against Mastodon
- Bulk operations (creating 100k objects) can overwhelm remote servers
- No standard compliance test suite
- Different implementations handle edge cases differently

### Practical Recommendations

1. **Test against multiple implementations** -- not just Mastodon
2. **Implement rate limiting** on both inbound and outbound federation
3. **Set recursion limits** on object resolution (prevent DoS)
4. **Use exponential backoff** for delivery retries
5. **Mark domains as dead** after repeated failures (stop wasting resources)
6. **Validate content origin** -- `Update`/`Delete` must come from same origin as original
7. **Handle content degradation gracefully** -- design for lowest-common-denominator rendering
8. **Implement a dual-content strategy** -- send rich content + Note fallback (like Manyfold)
9. **Log all federation activity** -- debugging federation issues requires full audit trail
10. **Don't assume content types** -- validate everything received from remote servers

---

## 13. CommonPub Content Mapping

### Actor Types

| CommonPub Entity | AP Actor Type | Notes |
|---|---|---|
| User | `Person` | Standard user account |
| Hub (community) | `Group` | FEP-1b12 Announce pattern |
| Hub (company) | `Organization` | Company profiles |
| Hub (product) | `Service` | Product pages |
| Instance | `Application` | Instance-level actor for admin/relay |

### Content Type Mapping

| CommonPub Content | AP Object Type | Rationale |
|---|---|---|
| Article | `Article` | Long-form content, standard AP type |
| Explainer | `Article` | Interactive content, fallback to static HTML for federation |
| Post/Discussion | `Note` | Short-form content |
| Comment | `Note` + `inReplyTo` | Threaded discussion |
| Product | `Article` + CommonPub extensions | No standard AP type for products |
| Learning Path | `OrderedCollection` | Ordered sequence of content |
| Learning Module | `Article` + extensions | Structured educational content |

### Article Object

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1",
    {
      "cpub": "https://commonpub.org/ns#",
      "Hashtag": "as:Hashtag",
      "sensitive": "as:sensitive"
    }
  ],
  "type": "Article",
  "id": "https://instance.com/articles/my-project",
  "attributedTo": "https://instance.com/users/alice",
  "name": "Building a CNC Router",
  "content": "<article>Full HTML content</article>",
  "source": {
    "content": "# Building a CNC Router\n\nMarkdown source...",
    "mediaType": "text/markdown"
  },
  "summary": "A guide to building your own CNC router from scratch",
  "published": "2024-01-01T00:00:00Z",
  "updated": "2024-01-15T00:00:00Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": [
    "https://instance.com/users/alice/followers",
    "https://instance.com/c/cnc-makers"
  ],
  "audience": "https://instance.com/c/cnc-makers",
  "attachment": [
    {
      "type": "Image",
      "mediaType": "image/jpeg",
      "url": "https://instance.com/media/router-photo.jpg",
      "name": "Completed CNC router on workbench",
      "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj"
    }
  ],
  "tag": [
    { "type": "Hashtag", "href": "https://instance.com/tags/cnc", "name": "#cnc" },
    { "type": "Hashtag", "href": "https://instance.com/tags/woodworking", "name": "#woodworking" },
    { "type": "Mention", "href": "https://instance.com/c/cnc-makers", "name": "@cnc-makers@instance.com" }
  ]
}
```

### Hub-Submitted Content Flow (Announce Pattern)

```
1. User creates Article addressed to Hub
   Create { actor: user, object: Article, to: [Public, hub] }

2. Hub inbox receives activity
   → Validate user permissions
   → Store content locally
   → Wrap in Announce

3. Hub sends Announce to all followers
   Announce { actor: hub, object: Create { ... }, to: [Public], cc: [hub/followers] }

4. Followers' instances receive Announce
   → Extract inner Create activity
   → Store content attributed to original author
   → Display in hub/community feeds
```

### CommonPub Namespace Extensions

```json
{
  "cpub": "https://commonpub.org/ns#",
  "cpub:hubType": "community | product | company",
  "cpub:contentType": "article | explainer | discussion | product",
  "cpub:difficulty": "beginner | intermediate | advanced",
  "cpub:license": "MIT | CC-BY-4.0 | ...",
  "cpub:compatibilityNote": true,
  "cpub:learningPath": "https://instance.com/paths/cnc-basics"
}
```

### Dual-Content Strategy (for Mastodon Compatibility)

When federating structured content (Articles, Products, Explainers), send a companion `Note` for microblogging platforms:

```json
{
  "type": "Note",
  "content": "<p>New article: <strong>Building a CNC Router</strong></p><p>A guide to building your own CNC router from scratch.</p><p><a href=\"https://instance.com/articles/my-project\">Read more</a></p>",
  "cpub:compatibilityNote": true,
  "tag": [
    { "type": "Hashtag", "name": "#cnc" },
    { "type": "Hashtag", "name": "#woodworking" }
  ]
}
```

Use NodeInfo `metadata` to advertise CommonPub capabilities, so CommonPub-to-CommonPub federation can skip the compatibility Note and exchange rich structured data directly.

---

## 14. Architecture Decisions

### Use Fedify's Queue Integration

**Decision:** Use Fedify's built-in queue system rather than a separate BullMQ worker.

- Fedify handles HTTP Signature signing, retry, and delivery internally
- Dev mode: `InProcessMessageQueue` (zero config)
- Production: `@fedify/postgres` PostgresMessageQueue (shared Postgres)
- Separate inbox/outbox queues supported (Fedify 1.3.0+)
- Default retry: exponential backoff, 10 attempts, 12-hour maximum
- Can migrate to separate worker if scale requires it

### Key Pair Strategy

Generate two key pairs per actor:
1. **RSA-PKCS#1-v1.5** (2048+ bits) -- HTTP Signatures, LD Signatures (broadest compatibility)
2. **Ed25519** -- Object Integrity Proofs (FEP-8b32, modern standard)

Store as JWK in database. Fedify handles serialization to PEM for AP responses.

### Hub Federation Model

Hubs use `Group` actor type with FEP-1b12 Announce pattern:
- Each hub has its own actor, inbox, outbox, followers collection
- Content submitted to hub is Announced to all hub followers
- Hub moderators listed in `attributedTo` pointing to moderators collection
- `audience` property identifies hub on all content
- Support FEP-400e `target` field for appendable collections

### Selective Federation

Implement three federation modes (per-instance, configurable per-hub):
1. **Open** (default): Federate with all, denylist specific instances
2. **Selective**: Allowlist specific instances for federation
3. **Private**: No outbound federation, local-only hub

### Content Federation Controls

- Public content: Full federation via Announce pattern
- Members-only content: Only to authenticated followers with approved Follow
- Private content: Never federated
- Learning progress: Never federated (local-only data)
- Product pricing: Federation-opt-in per product

### Instance Actor

Create an `Application` type actor at a reserved identifier (e.g., `~instance`) for:
- Shared inbox key management
- Relay subscription
- Federated reports
- Admin-level federation operations
- Breaking authorized fetch key loops

### NodeInfo Metadata

Advertise CommonPub capabilities in NodeInfo `metadata`:
```json
{
  "commonpub": {
    "version": "1.0.0",
    "hubTypes": ["community", "product", "company"],
    "contentTypes": ["article", "explainer", "discussion", "product"],
    "features": ["learning-paths", "docs", "editor"],
    "namespace": "https://commonpub.org/ns#"
  }
}
```

This enables CommonPub instances to discover each other and exchange rich structured data while falling back to standard AP for non-CommonPub instances.
