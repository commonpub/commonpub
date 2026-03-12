# Federation System Research

## Prior Art

### Mastodon

- Actor model: every user is an AP Person with inbox/outbox
- HTTP Signatures (draft-cavage-http-signatures-12) for authentication
- Shared inbox at `/inbox` for efficiency (single POST per instance)
- JSON-LD with `@context` arrays for extensibility
- Delivery: fan-out on write, each follower's inbox receives Create/Update/Delete
- Retry: exponential backoff (5m, 30m, 2h, 12h, 24h), marks domain as dead after repeated failures
- Content: Note (toots), with `sensitive`, `spoilerText`, `attachment` extensions
- Collections: OrderedCollection for outbox/followers/following with pagination

### Lemmy

- Community = AP Group actor (receives posts via inbox)
- Announce pattern: community re-broadcasts Create activities to all followers
- Custom extensions in `lemmy` namespace for community-specific fields
- Strict mode: rejects activities from non-federated instances
- Content mapping: Post → AP Page (not Article), Comment → AP Note with inReplyTo

### Misskey/Firefish

- Uses LD Signatures (deprecated) alongside HTTP Signatures
- Emoji reactions as custom Like activities with `_misskey_reaction` extension
- Drive system: media proxy for all remote content
- Quote posts via `_misskey_quote` extension (non-standard)

## Fedify API Patterns

### Federation Setup

```typescript
import { createFederation, MemoryKvStore } from '@fedify/fedify';

const federation = createFederation<AppContext>({
  kv: new MemoryKvStore(), // or DenoKvStore, RedisKvStore
});
```

### Actor Dispatcher

```typescript
federation.setActorDispatcher('/users/{identifier}', async (ctx, identifier) => {
  const user = await db.getUser(identifier);
  if (!user) return null;
  return new Person({
    id: ctx.getActorUri(identifier),
    preferredUsername: user.username,
    name: user.displayName,
    inbox: ctx.getInboxUri(identifier),
    outbox: ctx.getOutboxUri(identifier),
    followers: ctx.getFollowersUri(identifier),
    following: ctx.getFollowingUri(identifier),
    publicKey: (await ctx.getActorKeyPairs(identifier))[0].cryptographicKey,
  });
});
```

### Inbox Listener

```typescript
federation
  .setInboxListener('/users/{identifier}/inbox', async (ctx, identifier) => {
    // Route by activity type
  })
  .on(Follow, async (ctx, follow) => {
    // Process follow request
    await ctx.sendActivity({ identifier }, follow.actorId, new Accept({ object: follow }));
  })
  .on(Create, async (ctx, create) => {
    // Process new content
  });
```

### Key Pair Management

Fedify handles keypair generation and storage via `setKeyPairsDispatcher`:

```typescript
federation.setKeyPairsDispatcher(async (ctx, identifier) => {
  const keys = await db.getKeypairs(identifier);
  return keys.map((k) => ({
    privateKey: await importKey(k.privateKeyPem),
    publicKey: await importKey(k.publicKeyPem),
  }));
});
```

### Message Queue

```typescript
import { InProcessMessageQueue } from '@fedify/fedify';
// Or for production:
import { RedisMessageQueue } from '@fedify/redis';

const federation = createFederation<AppContext>({
  queue: new InProcessMessageQueue(),
});
```

## HTTP Signature Gotchas

1. **Digest header**: Must include `Digest: SHA-256=base64(sha256(body))` for POST requests
2. **Date header**: Must be within ±30 seconds of server time (clock skew tolerance)
3. **Key rotation**: Old keys must remain valid for a grace period; fetch public key on signature failure
4. **Algorithm**: RSA-SHA256 is the de facto standard; Ed25519 gaining adoption
5. **Signed headers**: Must include `(request-target)`, `host`, `date`, `digest` (for POST)
6. **Key ID format**: `https://domain/users/username#main-key` is conventional

## ActivityPub Content Mapping for CommonPub

### Article (project, article, blog, guide)

```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Article",
  "id": "https://instance.com/content/slug",
  "attributedTo": "https://instance.com/users/author",
  "name": "Title",
  "content": "<p>HTML body</p>",
  "summary": "Description",
  "published": "2024-01-01T00:00:00Z",
  "updated": "2024-01-02T00:00:00Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "cc": ["https://instance.com/users/author/followers"],
  "attachment": [],
  "tag": []
}
```

### Note (comment)

```json
{
  "type": "Note",
  "inReplyTo": "https://instance.com/content/parent-slug",
  "content": "<p>Comment text</p>",
  "attributedTo": "https://instance.com/users/commenter"
}
```

### Tombstone (deleted content)

```json
{
  "type": "Tombstone",
  "id": "https://instance.com/content/deleted-slug",
  "formerType": "Article"
}
```

## Queue Architecture Considerations

- BullMQ vs Fedify's built-in queue: Fedify has `InProcessMessageQueue` and optional Redis adapter
- For v1, use Fedify's built-in queue system rather than separate BullMQ worker
- This simplifies architecture: no separate worker process needed
- Fedify handles retry logic internally
- Can migrate to separate worker if scale requires it

## Key Decision: Fedify Built-in vs Custom Worker

**Recommendation**: Use Fedify's queue integration directly rather than a separate BullMQ worker.

- Fedify already handles HTTP Signature signing, retry, and delivery
- Adding BullMQ creates redundant queue infrastructure
- The `tools/worker` package can wrap Fedify's queue for monitoring/admin
- Dev mode: `InProcessMessageQueue` (zero config)
- Production: `@fedify/redis` RedisMessageQueue (shared Redis from docker-compose)
