# Federation Server Module

> Database operations for ActivityPub federation: keypair management, remote actor resolution, follow relationships, and activity logging.

**Source**: `packages/server/src/federation.ts`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `getOrCreateActorKeypair` | Function | Lazy RSA-2048 keypair generation |
| `resolveRemoteActor` | Function | Cache-first remote actor lookup |
| `sendFollow` | Function | Initiate a follow to a remote actor |
| `acceptFollow` | Function | Accept an incoming follow request |
| `rejectFollow` | Function | Reject an incoming follow request |
| `unfollowRemote` | Function | Undo a follow relationship |
| `federateContent` | Function | Send a Create activity for published content |
| `federateUpdate` | Function | Send an Update activity for edited content |
| `federateDelete` | Function | Send a Delete activity with Tombstone |
| `federateLike` | Function | Send a Like activity |
| `getFollowers` | Function | List accepted followers of an actor |
| `getFollowing` | Function | List accepted following of an actor |
| `listFederationActivity` | Function | Paginated activity log with filters |

---

## API Reference

### `getOrCreateActorKeypair`

```ts
function getOrCreateActorKeypair(
  db: NodePgDatabase,
  userId: string
): Promise<{ publicKeyPem: string; privateKeyPem: string }>
```

Lazily generates an RSA-2048 keypair for a local actor. Checks the `actorKeypairs` table first; if no keypair exists, generates a new one and stores it. Used by HTTP signature signing and the actor endpoint's `publicKey` field.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `userId` | `string` | UUID of the local user |

**Returns**: `{ publicKeyPem: string, privateKeyPem: string }`. PEM-encoded RSA-2048 key pair.

---

### `resolveRemoteActor`

```ts
function resolveRemoteActor(
  db: NodePgDatabase,
  actorUri: string
): Promise<ResolvedActor | null>
```

Resolves a remote ActivityPub actor with cache-first strategy. Checks the `remoteActors` table for a cached entry within the 24-hour TTL. If the cache is stale or missing, fetches the actor document from the remote server via HTTP, parses it, and upserts the `remoteActors` table.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `actorUri` | `string` | Full ActivityPub actor URI (e.g., `https://example.com/users/alice`) |

**Returns**: `ResolvedActor | null`. The resolved actor with inbox/outbox URLs, public key, display name, etc. Returns `null` if the remote actor cannot be fetched or parsed.

---

### `sendFollow`

```ts
function sendFollow(
  db: NodePgDatabase,
  localUserId: string,
  remoteActorUri: string,
  domain: string
): Promise<{ id: string }>
```

Initiates a follow relationship with a remote actor. Creates a `followRelationships` row with status `pending` and logs a Follow activity to the `activities` table.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `localUserId` | `string` | UUID of the local user sending the follow |
| `remoteActorUri` | `string` | ActivityPub URI of the remote actor to follow |
| `domain` | `string` | Local instance domain (for constructing the local actor URI) |

**Returns**: `{ id: string }`. The UUID of the created follow relationship.

---

### `acceptFollow`

```ts
function acceptFollow(
  db: NodePgDatabase,
  followRelationshipId: string,
  domain: string
): Promise<void>
```

Accepts an incoming follow request. Updates the `followRelationships` row status from `pending` to `accepted` and logs an Accept activity.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `followRelationshipId` | `string` | UUID of the follow relationship |
| `domain` | `string` | Local instance domain |

---

### `rejectFollow`

```ts
function rejectFollow(
  db: NodePgDatabase,
  followRelationshipId: string,
  domain: string
): Promise<void>
```

Rejects an incoming follow request. Updates the `followRelationships` row status to `rejected` and logs a Reject activity.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `followRelationshipId` | `string` | UUID of the follow relationship |
| `domain` | `string` | Local instance domain |

---

### `unfollowRemote`

```ts
function unfollowRemote(
  db: NodePgDatabase,
  localUserId: string,
  remoteActorUri: string,
  domain: string
): Promise<void>
```

Undoes an existing follow. Deletes the `followRelationships` row and logs an Undo activity wrapping the original Follow.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `localUserId` | `string` | UUID of the local user |
| `remoteActorUri` | `string` | ActivityPub URI of the remote actor being unfollowed |
| `domain` | `string` | Local instance domain |

---

### `federateContent`

```ts
function federateContent(
  db: NodePgDatabase,
  contentId: string,
  domain: string
): Promise<void>
```

Federates a newly published content item. Fetches the content and author from the database, maps the content to an ActivityPub Article object, wraps it in a Create activity, and logs the activity to the `activities` table for delivery.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `contentId` | `string` | UUID of the content item |
| `domain` | `string` | Local instance domain |

---

### `federateUpdate`

```ts
function federateUpdate(
  db: NodePgDatabase,
  contentId: string,
  domain: string
): Promise<void>
```

Federates an update to existing content. Same fetch-and-map flow as `federateContent`, but wraps the Article in an Update activity instead of Create.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `contentId` | `string` | UUID of the content item |
| `domain` | `string` | Local instance domain |

---

### `federateDelete`

```ts
function federateDelete(
  db: NodePgDatabase,
  contentId: string,
  domain: string,
  authorUsername: string
): Promise<void>
```

Federates a content deletion. Builds a Delete activity with a Tombstone object referencing the content's ActivityPub URI. The `authorUsername` is needed to construct the actor URI without fetching the (now-archived) content.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `contentId` | `string` | UUID of the content item |
| `domain` | `string` | Local instance domain |
| `authorUsername` | `string` | Username of the content author |

---

### `federateLike`

```ts
function federateLike(
  db: NodePgDatabase,
  userId: string,
  contentUri: string,
  domain: string
): Promise<void>
```

Federates a like. Builds a Like activity with the local actor as `actor` and the content URI as `object`, then logs it to the `activities` table.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `userId` | `string` | UUID of the local user who liked |
| `contentUri` | `string` | ActivityPub URI of the liked content |
| `domain` | `string` | Local instance domain |

---

### `getFollowers`

```ts
function getFollowers(
  db: NodePgDatabase,
  actorUri: string
): Promise<Array<{ followerActorUri: string; status: string }>>
```

Returns all accepted followers of a given actor. Filters `followRelationships` where `followingActorUri` matches and status is `accepted`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `actorUri` | `string` | ActivityPub URI of the actor whose followers to list |

**Returns**: Array of `{ followerActorUri, status }`. Only `accepted` relationships are returned.

---

### `getFollowing`

```ts
function getFollowing(
  db: NodePgDatabase,
  actorUri: string
): Promise<Array<{ followingActorUri: string; status: string }>>
```

Returns all actors that the given actor is following (accepted only). Filters `followRelationships` where `followerActorUri` matches and status is `accepted`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `actorUri` | `string` | ActivityPub URI of the actor whose following list to retrieve |

**Returns**: Array of `{ followingActorUri, status }`. Only `accepted` relationships are returned.

---

### `listFederationActivity`

```ts
function listFederationActivity(
  db: NodePgDatabase,
  filters?: {
    direction?: 'inbound' | 'outbound';
    status?: 'pending' | 'delivered' | 'failed';
    type?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: ActivityLogItem[]; total: number }>
```

Returns a paginated, filterable list of federation activity log entries from the `activities` table. Used by the admin panel to monitor federation health.

**Parameters**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `db` | `NodePgDatabase` | -- | Database connection |
| `filters.direction` | `string` | `undefined` | Filter by `inbound` or `outbound` |
| `filters.status` | `string` | `undefined` | Filter by delivery status |
| `filters.type` | `string` | `undefined` | Filter by activity type (e.g., `Create`, `Follow`, `Like`) |
| `filters.limit` | `number` | `20` | Page size, capped at `Math.min(filters.limit ?? 20, 100)` |
| `filters.offset` | `number` | `0` | Pagination offset |

**Returns**: `{ items: ActivityLogItem[], total: number }`. Items are ordered by creation time descending.
