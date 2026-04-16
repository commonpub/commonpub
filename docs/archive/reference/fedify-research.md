# Fedify Framework — Deep Research Reference

> Research date: 2026-03-20
> Latest stable version: **Fedify 2.0.0** (modular rewrite); **1.10.0** was last 1.x release (Dec 2025)
> Repository: https://github.com/fedify-dev/fedify
> Docs: https://fedify.dev
> License: MIT
> Funded by: Sovereign Tech Fund (EUR 192,000 over 2025-2026)

---

## 1. What Fedify Is

Fedify is a **TypeScript framework for building ActivityPub servers**. It handles the protocol plumbing — signatures, WebFinger, JSON-LD, inbox/outbox, content negotiation, collections, key management — so app code only deals with business logic. It works as **middleware** that intercepts requests and dispatches them to registered handlers based on path and `Accept` header.

Runtime support: Deno, Bun, Node.js. Framework support: Hono, Express, Fastify, h3 (Nitro/Nuxt), Fresh, Next.js, or any framework that speaks `Request`/`Response`.

---

## 2. Core Architecture — `createFederation()`

```typescript
import { createFederation, MemoryKvStore, InProcessMessageQueue } from "@fedify/fedify";

const federation = createFederation<MyContextData>({
  // REQUIRED: key-value store for caching, signature negotiation, idempotency
  kv: new MemoryKvStore(),  // dev only — use PostgresKvStore/RedisKvStore in prod

  // RECOMMENDED: message queue for async inbox/outbox processing
  queue: new InProcessMessageQueue(),  // dev only — use PostgresMessageQueue/RedisMessageQueue in prod

  // Separate queues for inbox vs outbox (since 1.3.0):
  // queue: {
  //   inbox: new PostgresMessageQueue(pg),
  //   outbox: new RedisMessageQueue(() => new Redis()),
  // },

  // Server origin (if not inferrable from request)
  origin: "https://example.com",
  // Or split WebFinger host from web origin:
  // origin: { handleHost: "example.com", webOrigin: "https://ap.example.com" },

  // Allow private IPs (dev only)
  allowPrivateAddress: true,

  // HTTP Signatures first-knock strategy
  firstKnock: "rfc9421",  // or "draft-cavage-http-signatures-12"

  // Retry policies (exponential backoff)
  outboxRetryPolicy: (attempt) => Math.pow(2, attempt) * 1000,
  inboxRetryPolicy: (attempt) => Math.pow(2, attempt) * 1000,

  // Permanent failure HTTP codes
  permanentFailureStatusCodes: [404, 410, 451],

  // Custom User-Agent
  userAgent: { software: "CommonPub/0.1.0", url: "https://commonpub.dev/" },

  // Trailing slash insensitivity
  trailingSlashInsensitive: true,

  // OpenTelemetry
  // tracerProvider: myTracerProvider,
});
```

### KvStore Options (Production)

| Store | Package | Backend |
|-------|---------|---------|
| `MemoryKvStore` | `@fedify/fedify` | In-memory (dev only) |
| `RedisKvStore` | `@fedify/redis` | Redis/Valkey |
| `PostgresKvStore` | `@fedify/postgres` | PostgreSQL |
| `DenoKvStore` | `@fedify/denokv` | Deno KV |

### MessageQueue Options (Production)

| Queue | Package | Backend |
|-------|---------|---------|
| `InProcessMessageQueue` | `@fedify/fedify` | In-memory (dev only) |
| `RedisMessageQueue` | `@fedify/redis` | Redis/Valkey |
| `PostgresMessageQueue` | `@fedify/postgres` | PostgreSQL |
| `AmqpMessageQueue` | `@fedify/amqp` | RabbitMQ/AMQP |
| `SqliteMessageQueue` | `@fedify/sqlite` | SQLite (dev/small) |

### Context Data (`TContextData`)

The generic type parameter flows through all dispatchers/listeners:

```typescript
const federation = createFederation<DatabasePool>({
  kv: new MemoryKvStore(),
});

federation.setActorDispatcher("/users/{id}", async (ctx, id) => {
  const db: DatabasePool = ctx.data;  // typed context data
  // ...
});

// Provided at request time:
federation.fetch(request, { contextData: getPool() });
```

### Builder Pattern (since 1.6.0)

Allows defining dispatchers separately from construction:

```typescript
// federation.ts
import { createFederationBuilder } from "@fedify/fedify";

export const builder = createFederationBuilder<void>();

builder.setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
  // ...
});

// main.ts
export const federation = await builder.build({
  kv: new MemoryKvStore(),
});
```

---

## 3. Actor Creation & Management

### Actor Dispatcher

```typescript
import { Person, Endpoints } from "@fedify/vocab";

federation.setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
  const user = await db.findUser(identifier);
  if (user == null) return null;

  const keys = await ctx.getActorKeyPairs(identifier);

  return new Person({
    id: ctx.getActorUri(identifier),
    preferredUsername: identifier,
    name: user.displayName,
    summary: user.bio,
    url: new URL(`/@${identifier}`, ctx.origin),
    published: Temporal.Instant.from(user.createdAt),

    // Federation endpoints
    inbox: ctx.getInboxUri(identifier),
    outbox: ctx.getOutboxUri(identifier),
    followers: ctx.getFollowersUri(identifier),
    following: ctx.getFollowingUri(identifier),
    endpoints: new Endpoints({
      sharedInbox: ctx.getInboxUri(),  // no arg = shared inbox
    }),

    // Cryptographic keys
    publicKey: keys[0].cryptographicKey,           // RSA for HTTP Signatures
    assertionMethods: keys.map(k => k.multikey),   // Ed25519 for Object Integrity Proofs
  });
});
```

Supported actor types: `Application`, `Group`, `Organization`, `Person`, `Service`.

### Key Pairs Dispatcher

```typescript
import { generateCryptoKeyPair, exportJwk, importJwk } from "@fedify/fedify";

federation
  .setActorDispatcher("/users/{identifier}", /* ... */)
  .setKeyPairsDispatcher(async (ctx, identifier) => {
    const user = await db.findUser(identifier);
    if (user == null) return [];

    // If no keys exist yet, generate and store them
    if (!user.rsaPrivateKey) {
      const rsa = await generateCryptoKeyPair("RSASSA-PKCS1-v1_5");
      const ed = await generateCryptoKeyPair("Ed25519");
      await db.storeKeys(identifier, {
        rsaPrivate: await exportJwk(rsa.privateKey),
        rsaPublic: await exportJwk(rsa.publicKey),
        edPrivate: await exportJwk(ed.privateKey),
        edPublic: await exportJwk(ed.publicKey),
      });
      return [rsa, ed];
    }

    // Load from DB
    return [
      {
        privateKey: await importJwk(user.rsaPrivateKey, "private"),
        publicKey: await importJwk(user.rsaPublicKey, "public"),
      },
      {
        privateKey: await importJwk(user.edPrivateKey, "private"),
        publicKey: await importJwk(user.edPublicKey, "public"),
      },
    ];
  });
```

**Critical**: Generate keys once at registration, store in DB. Re-generating on restart breaks federation because other servers cache your public keys.

### Decoupling WebFinger handle from internal identifier

```typescript
federation
  .setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
    const user = await db.findByUuid(identifier);
    // ...
  })
  .mapHandle(async (ctx, username) => {
    // Maps @username@domain to internal UUID
    const user = await db.findByUsername(username);
    return user?.uuid ?? null;
  });
```

---

## 4. Inbox/Outbox Processing

### Inbox Listeners

```typescript
import { Accept, Follow, Create, Note, Undo, Delete } from "@fedify/vocab";

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")  // personal, shared
  .on(Follow, async (ctx, follow) => {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) return;
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") return;
    const follower = await follow.getActor(ctx);
    if (follower == null) return;

    // Store the follow in DB
    await db.addFollower(parsed.identifier, follow.actorId.href);

    // Send Accept back
    await ctx.sendActivity(
      { identifier: parsed.identifier },
      follower,
      new Accept({ actor: follow.objectId, object: follow }),
    );
  })
  .on(Create, async (ctx, create) => {
    const object = await create.getObject(ctx);
    if (object instanceof Note) {
      // Handle incoming note
    }
  })
  .on(Undo, async (ctx, undo) => {
    const object = await undo.getObject(ctx);
    if (object instanceof Follow) {
      // Handle unfollow
    }
  })
  .on(Delete, async (ctx, del) => {
    // Handle deletion
  })
  .onError(async (ctx, error) => {
    console.error("Inbox error:", error);
  });
```

### Idempotency

```typescript
// Default in 2.0: "per-inbox" (deduplicates per recipient inbox)
federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .withIdempotency("per-inbox")
  // ...
```

### Shared Inbox Key Dispatcher (Instance Actor)

```typescript
federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .setSharedKeyDispatcher((_ctx) => ({ identifier: "~instance" }));

// Register the instance actor
federation.setActorDispatcher("/users/{identifier}", async (ctx, identifier) => {
  if (identifier === "~instance") {
    return new Application({
      id: ctx.getActorUri(identifier),
      preferredUsername: "instance.actor",
      inbox: ctx.getInboxUri(identifier),
      publicKey: (await ctx.getActorKeyPairs(identifier))[0].cryptographicKey,
    });
  }
  // Regular user actor...
});
```

### Forwarding Activities

```typescript
.on(Create, async (ctx, create) => {
  // Forward to followers of the target
  await ctx.forwardActivity(
    { identifier: "alice" },
    "followers",
    { skipIfUnsigned: true },
  );
});
```

### Manual Activity Routing

```typescript
.on(Announce, async (ctx, announce) => {
  const object = await announce.getObject();
  if (object instanceof Activity) {
    await ctx.routeActivity(ctx.recipient, object);
  }
});
```

---

## 5. Sending Activities & Fan-Out

### Basic sendActivity()

```typescript
await ctx.sendActivity(
  { identifier: senderId },       // sender
  recipient,                       // single Recipient, Recipient[], or "followers"
  new Create({
    id: new URL(`#create`, noteUri),
    actor: ctx.getActorUri(senderId),
    to: PUBLIC_COLLECTION,
    cc: ctx.getFollowersUri(senderId),
    object: new Note({
      id: noteUri,
      attribution: ctx.getActorUri(senderId),
      content: "Hello fediverse!",
      to: PUBLIC_COLLECTION,
      cc: ctx.getFollowersUri(senderId),
    }),
  }),
  {
    preferSharedInbox: true,   // consolidate deliveries
    // immediate: true,        // bypass queue, deliver synchronously
    // fanout: "force",        // force fan-out even if audience is small
    // orderingKey: noteUri.href,  // FIFO ordering guarantee (2.0+)
  },
);
```

### Recipient Types

```typescript
// By actor object
await ctx.sendActivity({ identifier: "alice" }, actor, activity);

// Multiple actors
await ctx.sendActivity({ identifier: "alice" }, [actor1, actor2], activity);

// Custom Recipient
await ctx.sendActivity(
  { identifier: "alice" },
  { id: new URL("https://..."), inboxId: new URL("https://.../inbox") } satisfies Recipient,
  activity,
);

// All followers (requires followers dispatcher)
await ctx.sendActivity({ identifier: "alice" }, "followers", activity);
```

### Ordered Delivery (2.0+)

Prevents "zombie post" problem (Delete arriving before Create):

```typescript
// Create
await ctx.sendActivity(sender, recipients, createActivity, { orderingKey: noteId.href });
// Delete — guaranteed to be delivered after Create
await ctx.sendActivity(sender, recipients, deleteActivity, { orderingKey: noteId.href });
```

### Permanent Failure Handler (2.0+)

```typescript
federation.setOutboxPermanentFailureHandler(async (ctx, values) => {
  console.warn(`Inbox ${values.inbox.href} permanently failed (${values.statusCode})`);
  for (const actorId of values.actorIds) {
    await db.removeFollower(actorId);
  }
});
```

### Privacy Addressing

| Visibility | `to` | `cc` |
|---|---|---|
| Public | `PUBLIC_COLLECTION` | `ctx.getFollowersUri()` |
| Quiet public | `ctx.getFollowersUri()` | `PUBLIC_COLLECTION` |
| Followers-only | `ctx.getFollowersUri()` | (empty) |
| Direct | (mentioned actors) | (empty) |

---

## 6. WebFinger

WebFinger is **automatically exposed** at `/.well-known/webfinger` by `Federation.fetch()`. No manual route needed.

### Custom WebFinger Links

```typescript
federation.setWebFingerLinksDispatcher(async (ctx, resource) => {
  return [
    {
      rel: "http://ostatus.org/schema/1.0/subscribe",
      template: `https://your-domain.com/authorize_interaction?uri={uri}`,
    },
  ];
});
```

### WebFinger Client (Lookup)

```typescript
// Via context
const wf = await ctx.lookupWebFinger("acct:user@example.com");
const actorLink = wf?.links?.find(
  l => l.rel === "self" && l.type === "application/activity+json"
);

// Standalone
import { lookupWebFinger } from "@fedify/webfinger";
const result = await lookupWebFinger("acct:alice@example.com", {
  userAgent: "MyApp/1.0",
  signal: AbortSignal.timeout(5000),
});
```

---

## 7. HTTP Signatures

Fedify implements **four authentication mechanisms**:

1. **HTTP Signatures** (draft-cavage) — legacy, wide compatibility
2. **HTTP Message Signatures** (RFC 9421) — modern standard
3. **Linked Data Signatures** — for forwarded activities
4. **Object Integrity Proofs** (FEP-8b32) — Ed25519-based

### Double-Knocking Strategy

Fedify tries RFC 9421 first, falls back to draft-cavage if rejected. It **caches** which spec each server supports to avoid repeated failures.

All of this is handled automatically when you call `sendActivity()` — no manual signature code needed. Key pairs from the key pairs dispatcher are used for signing.

---

## 8. Object Dispatchers

Register handlers for fetching individual objects by URI:

```typescript
import { Note, Article } from "@fedify/vocab";

federation.setObjectDispatcher(
  Note,
  "/users/{userId}/notes/{noteId}",
  async (ctx, { userId, noteId }) => {
    const note = await db.getNote(noteId);
    if (note == null || note.authorId !== userId) return null;
    return new Note({
      id: ctx.getObjectUri(Note, { userId, noteId }),
      attribution: ctx.getActorUri(userId),
      content: note.content,
      published: Temporal.Instant.from(note.createdAt),
    });
  }
);

federation.setObjectDispatcher(
  Article,
  "/users/{userId}/articles/{articleId}",
  async (ctx, { userId, articleId }) => {
    const article = await db.getArticle(articleId);
    if (article == null) return null;
    return new Article({
      id: ctx.getObjectUri(Article, { userId, articleId }),
      attribution: ctx.getActorUri(userId),
      name: article.title,
      content: article.htmlContent,
    });
  }
);
```

Construct URIs elsewhere:

```typescript
const noteUri = ctx.getObjectUri(Note, { userId: "abc", noteId: "123" });
```

---

## 9. Collections (Followers, Following, Outbox)

### Outbox with Pagination

```typescript
federation
  .setOutboxDispatcher("/users/{identifier}/outbox", async (ctx, identifier, cursor) => {
    if (cursor == null) return null;
    const { posts, nextCursor, last } = await db.getPostsByUser(
      identifier,
      cursor === "" ? { limit: 20 } : { cursor, limit: 20 },
    );
    return {
      items: posts.map(post => new Create({
        id: new URL(`/posts/${post.id}#activity`, ctx.url),
        actor: ctx.getActorUri(identifier),
        object: new Article({
          id: new URL(`/posts/${post.id}`, ctx.url),
          name: post.title,
          content: post.content,
        }),
      })),
      nextCursor: last ? null : nextCursor,
    };
  })
  .setFirstCursor(async (ctx, identifier) => "")
  .setCounter(async (ctx, identifier) => await db.countPosts(identifier));
```

### Followers with Pagination

```typescript
federation
  .setFollowersDispatcher("/users/{identifier}/followers", async (ctx, identifier, cursor) => {
    if (cursor == null) return null;
    const { users, nextCursor, last } = await db.getFollowers(
      identifier,
      cursor === "" ? { limit: 20 } : { cursor, limit: 20 },
    );
    return {
      items: users.map(u => ({
        id: new URL(u.uri),
        inboxId: new URL(u.inboxUri),
      })),
      nextCursor: last ? null : nextCursor,
    };
  })
  .setFirstCursor(async (ctx, identifier) => "");
```

### Following with Pagination

```typescript
federation
  .setFollowingDispatcher("/users/{identifier}/following", async (ctx, identifier, cursor) => {
    if (cursor == null) return null;
    const { users, nextCursor, last } = await db.getFollowing(
      identifier,
      cursor === "" ? { limit: 20 } : { cursor, limit: 20 },
    );
    return {
      items: users.map(u => new URL(u.uri)),
      nextCursor: last ? null : nextCursor,
    };
  })
  .setFirstCursor(async (ctx, identifier) => "");
```

### Followers Collection Synchronization

```typescript
// When sending to followers, enables efficient sync with Mastodon
await ctx.sendActivity(
  { identifier: senderId },
  "followers",
  activity,
  { preferSharedInbox: true, syncCollection: true },
);
```

---

## 10. JSON-LD & Vocabulary

### Creating Objects

```typescript
import { Create, Note, Article, LanguageString } from "@fedify/vocab";

const note = new Note({
  id: new URL("https://example.com/notes/1"),
  content: "Hello, world!",
  published: Temporal.Instant.from("2024-01-01T00:00:00Z"),
});

// Multilingual content
const multiNote = new Note({
  id: new URL("https://example.com/notes/2"),
  content: new LanguageString("Hello!", "en"),
});

const translated = multiNote.clone({
  content: new LanguageString("Bonjour!", "fr"),
});
```

### JSON-LD Serialization/Deserialization

```typescript
// Serialize
const jsonLd = await note.toJsonLd();

// Deserialize
const parsed = await Create.fromJsonLd({
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "id": "https://example.com/activities/1",
  "actor": "https://example.com/users/alice",
  "object": {
    "type": "Note",
    "id": "https://example.com/notes/1",
    "content": "Hello!",
  },
});
```

### Property Access — Lazy Loading

```typescript
// Access URI without fetching
const objectId = create.objectId;  // URL | null

// Fetch/dereference the embedded or remote object
const note = await create.getObject(ctx);  // Note | null (may trigger HTTP fetch)

// Cross-origin security
const note = await create.getObject({ crossOrigin: "throw" });  // throws on cross-origin
```

### Custom Vocabulary Extension (2.0+)

The `fedify generate-vocab` CLI command generates TypeScript classes from schema files, using `@fedify/vocab-tools`. This enables extending ActivityPub with custom types beyond the standard vocabulary.

---

## 11. Framework Integration — H3/Nuxt/Nitro

### `@fedify/h3` (the key package for CommonPub)

```typescript
import { createApp, createRouter } from "h3";
import { createFederation } from "@fedify/fedify";
import { integrateFederation, onError } from "@fedify/h3";

const federation = createFederation<string>({
  // ...
});

const app = createApp({ onError });  // onError is REQUIRED for content negotiation
app.use(
  integrateFederation(federation, (event, request) => "context data")
);

const router = createRouter();
app.use(router);
```

**For Nuxt/Nitro**: Since Nitro uses h3 under the hood, `@fedify/h3` works as Nitro server middleware. The pattern is:

1. Create a Nitro plugin or server middleware that sets up the federation
2. Use `integrateFederation()` as h3 middleware
3. The `onError` handler must be configured for content negotiation to work

**Note**: There is no official `@fedify/nuxt` package yet (see [GitHub issue #149](https://github.com/fedify-dev/fedify/issues/149)), but h3 integration works.

### Express

```typescript
import express from "express";
import { integrateFederation } from "@fedify/express";

const app = express();
app.set("trust proxy", true);
app.use(integrateFederation(federation, (req) => "context data"));
```

### Hono

```typescript
import { federation as fedMiddleware } from "@fedify/hono";
import { Hono } from "hono";

const app = new Hono();
app.use(fedMiddleware(fedi, (ctx) => "context data"));
```

### Generic (any framework)

```typescript
// Use Federation.fetch() directly with onNotFound/onNotAcceptable callbacks
const response = await federation.fetch(request, {
  contextData: myData,
  onNotFound: () => new Response("Not Found", { status: 404 }),
  onNotAcceptable: () => new Response("Not Acceptable", { status: 406 }),
});
```

---

## 12. NodeInfo

```typescript
federation.setNodeInfoDispatcher("/nodeinfo/2.1", async (ctx) => {
  return {
    software: {
      name: "commonpub",
      version: "0.1.0",
      homepage: new URL("https://commonpub.dev/"),
    },
    protocols: ["activitypub"],
    usage: {
      users: {
        total: await db.countUsers(),
        activeHalfyear: await db.countActiveUsers(180),
        activeMonth: await db.countActiveUsers(30),
      },
      localPosts: await db.countPosts(),
      localComments: await db.countComments(),
    },
  };
});
```

---

## 13. Fedify 2.0.0 — Breaking Changes & Migration

### Modular Package Split

| Legacy Import | New Package |
|---|---|
| `@fedify/fedify/vocab` | `@fedify/vocab` |
| `@fedify/fedify/runtime` | `@fedify/vocab-runtime` |
| `@fedify/fedify/x/hono` | `@fedify/hono` |
| `@fedify/fedify/x/fresh` | `@fedify/fresh` |
| (new) | `@fedify/webfinger` — standalone WebFinger |
| (new) | `@fedify/vocab-tools` — custom vocab generation |
| (new) | `@fedify/debugger` — debug dashboard |
| (new) | `@fedify/relay` — relay server support |

### Key Breaking Changes

- `LanguageTag` replaced with standard `Intl.Locale`
- `software.version` in NodeInfo changed from `SemVer` to `string`
- Default idempotency changed from `"per-origin"` to `"per-inbox"`
- `KvStore.list()` method now mandatory
- Content negotiation moved to middleware layer
- Old `contextLoader`/`documentLoader` options removed

### New Features

- **Debug dashboard**: `@fedify/debugger` provides `/__debug__/` endpoint with activity traces
- **Relay support**: `@fedify/relay` for Mastodon-style and LitePub-style relays
- **Ordered delivery**: `orderingKey` option on `sendActivity()`
- **Permanent failure handling**: `setOutboxPermanentFailureHandler()`
- **Custom vocabulary generation**: `fedify generate-vocab` CLI command

---

## 14. Hollo — Reference Fedify App

[Hollo](https://github.com/fedify-dev/hollo) is a single-user microblogging server built by Fedify's author. Key patterns:

- **Stack**: TypeScript, Fedify, Drizzle ORM (same ORM as CommonPub), Docker
- **Database**: PostgreSQL (via Drizzle)
- **API**: Mastodon-compatible API (works with Mastodon clients)
- **Features**: CommonMark content, Misskey-style quotes, full federation
- **Architecture**: Fedify handles all AP plumbing; app code is business logic only

This is the closest reference for how CommonPub should integrate Fedify.

---

## 15. Fedify vs Other ActivityPub Libraries

| Feature | Fedify | activitypub-express |
|---|---|---|
| Language | TypeScript | JavaScript |
| Framework | Framework-agnostic (middleware) | Express.js only |
| Type safety | Full — typed AP objects | Minimal |
| Signatures | HTTP Sig + RFC 9421 + LD Sig + OIP | HTTP Signatures only |
| WebFinger | Automatic | Manual setup |
| Collections | Built-in dispatchers | Manual |
| JSON-LD | Full support + custom vocab | Basic |
| Queue system | Pluggable (Redis, PG, AMQP) | None built-in |
| Key management | Built-in generation/storage | Manual |
| Active maintenance | Yes (funded) | Sporadic |
| Production apps | Hollo, others | Immers Space |

**Verdict**: Fedify is the clear choice for new TypeScript AP projects. It is more comprehensive, better maintained, better funded, and framework-agnostic.

---

## 16. Limitations & Known Issues

### Deployment Constraints
- **Cloudflare Workers**: Limited support due to missing Node.js crypto APIs, execution time limits, and non-standard fetch behavior. Requires special `WorkersMessageQueue`.
- **Large audiences**: Fan-out to many recipients can cause latency if not using a proper message queue.

### Security (Fixed)
- A **critical authentication bypass** was found and fixed where inbox activities were processed before verifying HTTP Signature ownership. Ensure you're on a recent version.
- A `verifyRequest()` TypeError with `created`/`expires` fields was fixed.

### Architecture Considerations
- Keys must be generated once and stored persistently. Regenerating on restart breaks federation.
- The `onError` handler is **mandatory** when using h3 integration for content negotiation to work.
- No official Nuxt module yet — use `@fedify/h3` as Nitro middleware.

### What Fedify Does NOT Do
- No built-in database schema — you bring your own (Drizzle + Postgres for us)
- No user management — you bring your own auth (Better Auth for us)
- No UI — it's a protocol framework only
- No built-in moderation tools — app responsibility
- No automatic content rendering — just AP object plumbing

---

## 17. CommonPub Integration Plan

Based on this research, the `@commonpub/protocol` package should:

1. **Use `createFederationBuilder()`** to define dispatchers in the package, then `.build()` in the Nuxt app with runtime config
2. **Use `@fedify/h3`** as Nitro server middleware via a Nitro plugin
3. **Use `PostgresKvStore` + `PostgresMessageQueue`** from `@fedify/postgres` (same PG instance as main DB)
4. **Store key pairs as JWK in the users table** via Drizzle, loaded by the key pairs dispatcher
5. **Map WebFinger handles** via `.mapHandle()` to decouple `@username@domain` from internal UUIDs
6. **Register inbox listeners** for Follow, Create, Update, Delete, Undo, Accept, Reject, Announce, Like
7. **Register object dispatchers** for Note, Article (and any custom content types)
8. **Register collection dispatchers** for outbox, followers, following with cursor-based pagination
9. **Set up NodeInfo** with CommonPub software metadata
10. **Use ordered delivery** (`orderingKey`) for Create/Delete pairs
11. **Implement permanent failure handler** to clean up dead followers

Target Fedify version: **2.0.x** (for modular imports, ordered delivery, debug dashboard)
