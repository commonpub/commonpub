# Lifecycle Hooks (consumer extension API)

`@commonpub/server` exposes a small in-process event bus so consumer apps (and the layer's own
server plugins) can react to domain events without modifying core code.

```ts
import { onHook, emitHook } from '@commonpub/server';

// In a Nitro server plugin:
export default defineNitroPlugin(() => {
  onHook('content:published', async ({ db, contentId, authorId }) => {
    // index in search, notify followers, ping a webhook, …
  });
});
```

- Handlers run **sequentially, after** the originating write has committed — subscribers never
  see uncommitted state and can't roll the write back.
- A handler that throws is isolated (it won't break the business operation); emitters that are
  best-effort (e.g. `user:registered`) additionally swallow handler errors.
- Register handlers once at startup (in a server plugin). The bus is per-process.

## Events

| Event | Fired when | Payload |
|---|---|---|
| `content:published` | content status → published (`onContentPublished`) | `db, contentId, authorId, contentType, slug` |
| `content:updated` | published content updated (`onContentUpdated`) | `db, contentId, authorId` |
| `content:deleted` | content deleted/unpublished (`onContentDeleted`) | `db, contentId, authorId` |
| `content:liked` | a content item (project/article/blog/explainer) is liked | `db, contentId, userId` |
| `content:unliked` | a content item is un-liked | `db, contentId, userId` |
| `comment:created` | a comment is created | `db, commentId, authorId, targetType, targetId` |
| `hub:post:created` | a hub post is created | `db, postId, hubId, authorId, postType` |
| `hub:member:joined` | a user joins a hub | `db, hubId, userId, role` |
| `hub:member:left` | a user leaves a hub | `db, hubId, userId` |
| `hub:content:shared` | content is shared into a hub | `db, hubId, contentId, userId` |
| `user:registered` | a new user registers (via Better Auth) | `db, userId, username, email` |
| `federation:content:received` | remote content ingested into `federated_content` | `db, federatedContentId, objectUri, actorUri, originDomain, apType, cpubType` |
| `federation:hub:post:received` | a federated hub post is ingested | `db, federatedHubPostId, federatedHubId, actorUri, postType` |

> `content:liked`/`unliked` fire only for content items — likes on posts/comments/videos do not
> emit a content hook. `user:registered` is bridged from Better Auth's `databaseHooks.user.create.after`
> via the layer (the auth package can't depend on the server's bus), so it fires on real
> registrations, not on admin-seeded users.

## Built-in subscribers

The layer's `search-index.ts` plugin subscribes to `content:published`/`updated`/`deleted` to
keep Meilisearch/FTS current. Other layer concerns (federation delivery, notification email) use
direct Nitro plugins/timers rather than the bus. Consumer apps can add their own `onHook`
subscribers freely.
