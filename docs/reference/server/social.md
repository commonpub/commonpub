# Social Server Module

> Database operations for likes, comments, and bookmarks across content, hub posts, and comments.

**Source**: `packages/server/src/social/`

---

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `toggleLike` | Function | Toggle a like on/off (transaction) |
| `isLiked` | Function | Check if a user has liked a target |
| `isBookmarked` | Function | Check if a user has bookmarked a target |
| `listComments` | Function | Threaded comment list for a target |
| `createComment` | Function | Add a comment (top-level or reply) |
| `deleteComment` | Function | Delete a comment (ownership-checked) |
| `toggleBookmark` | Function | Toggle a bookmark on/off (transaction) |
| `listUserBookmarks` | Function | List all bookmarks for a user |
| `followUser` | Function | Follow a user |
| `unfollowUser` | Function | Unfollow a user |
| `isFollowing` | Function | Check if a user follows another |
| `listFollowers` | Function | List a user's followers |
| `listFollowing` | Function | List who a user follows |
| `createReport` | Function | File a moderation report |
| `extractMentions` | Function | Parse @mentions from text |
| `resolveUsernames` | Function | Resolve @mention usernames to user IDs |
| `onContentLiked` | Federation hook | Federate a Like activity |
| `onContentUnliked` | Federation hook | Federate an Undo(Like) activity |

---

## API Reference

### `toggleLike`

```ts
function toggleLike(
  db: NodePgDatabase,
  userId: string,
  targetType: 'content' | 'comment' | 'hubPost',
  targetId: string
): Promise<{ liked: boolean }>
```

Toggles a like within a database transaction. Checks for an existing like row: if found, deletes it and decrements the denormalized `likeCount` on the target; if not found, inserts a new like and increments the count.

The target table is resolved from `targetType`:

| `targetType` | Target table |
|--------------|-------------|
| `content` | `contentItems` |
| `comment` | `comments` |
| `post` | `hubPosts` |

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `userId` | `string` | UUID of the user toggling the like |
| `targetType` | `string` | Type of the liked entity |
| `targetId` | `string` | UUID of the liked entity |

**Returns**: `{ liked: boolean }`. `true` if a like was created, `false` if a like was removed.

**Notes**: Uses `GREATEST(likeCount - 1, 0)` on unlike to prevent negative counts.

---

### `isLiked`

```ts
function isLiked(
  db: NodePgDatabase,
  userId: string,
  targetType: 'content' | 'comment' | 'hubPost',
  targetId: string
): Promise<boolean>
```

Checks whether a like row exists for the given user and target.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `userId` | `string` | UUID of the user |
| `targetType` | `string` | Type of the target entity |
| `targetId` | `string` | UUID of the target entity |

**Returns**: `boolean`. `true` if the user has liked the target.

---

### `listComments`

```ts
function listComments(
  db: NodePgDatabase,
  targetType: 'content' | 'hubPost',
  targetId: string
): Promise<CommentItem[]>
```

Fetches all comments for a target with an inner join on `users` for author information. Builds a threaded structure by grouping replies under their parent using a `parentId` to replies map. Top-level comments (where `parentId` is `null`) are returned as the root array, each with a `replies` array attached.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `targetType` | `string` | Type of the commented entity |
| `targetId` | `string` | UUID of the commented entity |

**Returns**: `CommentItem[]`. A flat-to-threaded array of top-level comments, each with nested `replies: CommentItem[]`.

---

### `createComment`

```ts
function createComment(
  db: NodePgDatabase,
  authorId: string,
  input: {
    targetType: 'content' | 'hubPost';
    targetId: string;
    parentId?: string;
    body: string;
  }
): Promise<CommentItem>
```

Inserts a new comment and updates denormalized counts. If `parentId` is provided, the comment is a reply and the parent comment's `replyCount` is incremented. The target entity's `commentCount` is always incremented.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `authorId` | `string` | UUID of the commenting user |
| `input.targetType` | `string` | Type of the target entity |
| `input.targetId` | `string` | UUID of the target entity |
| `input.parentId` | `string` | Optional. UUID of the parent comment (for replies) |
| `input.body` | `string` | Comment body text |

**Returns**: `CommentItem`. The newly created comment with author information.

---

### `deleteComment`

```ts
function deleteComment(
  db: NodePgDatabase,
  commentId: string,
  authorId: string
): Promise<boolean>
```

Deletes a comment after verifying ownership. Decrements the denormalized `commentCount` on the target entity. If the comment was a reply, also decrements the parent comment's `replyCount`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `commentId` | `string` | UUID of the comment to delete |
| `authorId` | `string` | UUID of the requesting user (must be the author) |

**Returns**: `boolean`. `true` if the comment was deleted, `false` if not found or not owned.

**Notes**: Uses `GREATEST(count - 1, 0)` to prevent negative counts on decrement.

---

### `toggleBookmark`

```ts
function toggleBookmark(
  db: NodePgDatabase,
  userId: string,
  targetType: 'content' | 'hubPost',
  targetId: string
): Promise<{ bookmarked: boolean }>
```

Toggles a bookmark within a database transaction. Same check-then-insert-or-delete pattern as `toggleLike`, but bookmarks do not affect any denormalized counts (they are private to the user).

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `userId` | `string` | UUID of the user |
| `targetType` | `string` | Type of the bookmarked entity |
| `targetId` | `string` | UUID of the bookmarked entity |

**Returns**: `{ bookmarked: boolean }`. `true` if a bookmark was created, `false` if removed.

---

## Federation Hook

### `onContentLiked`

```ts
function onContentLiked(
  db: NodePgDatabase,
  userId: string,
  contentUri: string,
  config: CommonPubConfig
): Promise<void>
```

Called by route handlers after a successful like on federated content. Checks `config.features.federation` and, if enabled, calls `federateLike(db, userId, contentUri, config.domain)` to send a Like activity to the content's origin server. Always invoked with `.catch(() => {})`.

**Parameters**

| Name | Type | Description |
|------|------|-------------|
| `db` | `NodePgDatabase` | Database connection |
| `userId` | `string` | UUID of the local user who liked |
| `contentUri` | `string` | ActivityPub URI of the liked content |
| `config` | `CommonPubConfig` | App config (checked for `features.federation`) |
