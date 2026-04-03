# Content Server Module

> Database operations for creating, reading, updating, and deleting content items (articles, tutorials, snippets).

**Source**: `packages/server/src/content/`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `listContent` | Function | Paginated content listing with filters |
| `getContentBySlug` | Function | Fetch single content item by slug |
| `createContent` | Function | Create a new draft content item |
| `updateContent` | Function | Update an existing content item (ownership-checked) |
| `deleteContent` | Function | Soft-delete by archiving (ownership-checked) |
| `publishContent` | Function | Shorthand to publish a draft |
| `incrementViewCount` | Function | Atomic view count increment |
| `createContentVersion` | Function | Save a version snapshot on publish |
| `listContentVersions` | Function | List all versions of a content item |
| `forkContent` | Function | Fork a local content item |
| `forkFederatedContent` | Function | Fork federated content into a local draft |
| `toggleBuildMark` | Function | Toggle build mark on local content |
| `toggleFederatedBuildMark` | Function | Toggle build mark on federated content |
| `isBuildMarked` | Function | Check if local content is build-marked |
| `isFederatedBuildMarked` | Function | Check if federated content is build-marked |
| `onContentPublished` | Federation hook | Federate a Create activity on first publish |
| `onContentUpdated` | Federation hook | Federate an Update activity |
| `onContentDeleted` | Federation hook | Federate a Delete activity |
| `onContentStatusChange` | Federation hook | Handle content status transitions |

---

## API Reference

### `listContent`

```ts
function listContent(
  db: NodePgDatabase,
  filters?: {
    status?: ContentStatus;
    type?: ContentType;
    authorId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: ContentListItem[]; total: number }>
```

Returns a paginated list of content items. Inner joins the `users` table to include author name and avatar on each item.

**Parameters**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `db` | `NodePgDatabase` | -- | Database connection |
| `filters.status` | `ContentStatus` | `undefined` | Filter by status (`draft`, `published`, `archived`) |
| `filters.type` | `ContentType` | `undefined` | Filter by content type |
| `filters.authorId` | `string` | `undefined` | Filter by author |
| `filters.limit` | `number` | `20` | Page size, capped at `Math.min(filters.limit ?? 20, 100)` |
| `filters.offset` | `number` | `0` | Pagination offset |

**Returns**: `{ items: ContentListItem[], total: number }`. Items are ordered by `publishedAt` descending (most recent first).

---

### `getContentBySlug`

```ts
function getContentBySlug(
  db: NodePgDatabase,
  slug: string,
  requesterId?: string
): Promise<ContentDetail | null>
```

Fetches a single content item by its URL slug, including associated tags, enriched author data, and related content. Non-published content (draft or archived) is only returned if `requesterId` matches the author.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `slug` | `string` | URL slug of the content item |
| `requesterId` | `string` | Optional. ID of the requesting user (for draft access) |

**Returns**: `ContentDetail | null`. Returns `null` if not found or if the item is unpublished and the requester is not the author.

**Enriched data** (fetched in parallel via `Promise.all`):
- `author.bio`, `author.headline` — from users table
- `author.followerCount` — count from follows table where `followingId = author.id`
- `author.articleCount` — count of published content by this author
- `author.totalViews` — sum of `viewCount` across all author's content
- `related` — up to 3 most recent published items of the same content type (excluding current item)

---

### `createContent`

```ts
function createContent(
  db: NodePgDatabase,
  authorId: string,
  input: CreateContentInput
): Promise<ContentDetail>
```

Creates a new content item in `draft` status. Automatically generates a URL slug from the title and a random preview token for sharing unpublished drafts.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `authorId` | `string` | UUID of the creating user |
| `input` | `CreateContentInput` | Title, type, body, tags, and other fields |

**Returns**: `ContentDetail`. The newly created content item with all fields populated.

**Notes**: The slug is generated from the title with a short random suffix to avoid collisions. Status is always `draft` on creation regardless of what the input contains.

---

### `updateContent`

```ts
function updateContent(
  db: NodePgDatabase,
  contentId: string,
  authorId: string,
  input: UpdateContentInput
): Promise<ContentDetail | null>
```

Updates an existing content item. Performs an ownership check -- only the original author can update. If the title changes, the slug is regenerated. If the status transitions to `published` for the first time, `publishedAt` is set to the current timestamp.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `contentId` | `string` | UUID of the content item |
| `authorId` | `string` | UUID of the requesting user (must be the author) |
| `input` | `UpdateContentInput` | Partial update fields |

**Returns**: `ContentDetail | null`. Returns `null` if the content item does not exist or if the ownership check fails.

---

### `deleteContent`

```ts
function deleteContent(
  db: NodePgDatabase,
  contentId: string,
  authorId: string
): Promise<boolean>
```

Soft-deletes a content item by setting its status to `archived`. Performs an ownership check.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `contentId` | `string` | UUID of the content item |
| `authorId` | `string` | UUID of the requesting user (must be the author) |

**Returns**: `boolean`. `true` if the item was archived, `false` if not found or not owned by the requester.

---

### `publishContent`

```ts
function publishContent(
  db: NodePgDatabase,
  contentId: string,
  authorId: string
): Promise<ContentDetail | null>
```

Convenience wrapper that calls `updateContent` with `{ status: 'published' }`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `contentId` | `string` | UUID of the content item |
| `authorId` | `string` | UUID of the requesting user (must be the author) |

**Returns**: `ContentDetail | null`. The updated content item, or `null` on failure.

---

### `incrementViewCount`

```ts
function incrementViewCount(
  db: NodePgDatabase,
  contentId: string
): Promise<void>
```

Atomically increments the denormalized `viewCount` column using `sql\`${contentItems.viewCount} + 1\``.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `contentId` | `string` | UUID of the content item |

**Returns**: `void`.

---

## Federation Hooks

These functions are called by route handlers after successful write operations, gated behind `config.features.federation`. They are always invoked with `.catch(() => {})` to prevent federation errors from affecting the primary operation.

### `onContentPublished`

```ts
function onContentPublished(
  db: NodePgDatabase,
  contentId: string,
  config: CommonPubConfig
): Promise<void>
```

Checks `config.features.federation`. If enabled, calls `federateContent(db, contentId, config.domain)` to send a Create activity to followers.

### `onContentUpdated`

```ts
function onContentUpdated(
  db: NodePgDatabase,
  contentId: string,
  config: CommonPubConfig
): Promise<void>
```

Checks `config.features.federation`. If enabled, calls `federateUpdate(db, contentId, config.domain)` to send an Update activity.

### `onContentDeleted`

```ts
function onContentDeleted(
  db: NodePgDatabase,
  contentId: string,
  authorUsername: string,
  config: CommonPubConfig
): Promise<void>
```

Checks `config.features.federation`. If enabled, calls `federateDelete(db, contentId, config.domain, authorUsername)` to send a Delete activity with a Tombstone object.
