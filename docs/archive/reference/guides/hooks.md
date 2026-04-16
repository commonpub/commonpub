# Hook System

CommonPub provides a typed hook system that lets consumer apps react to lifecycle events without modifying core code. Register handlers in a Nitro server plugin; they'll be called after the corresponding operations complete.

## Quick Start

```ts
// server/plugins/my-hooks.ts
import { onHook } from '@commonpub/server';

export default defineNitroPlugin(() => {
  onHook('content:published', async ({ db, contentId, contentType, slug }) => {
    console.log(`New ${contentType} published: ${slug}`);
    // Your custom logic: sync to CMS, notify Slack, update analytics, etc.
  });

  onHook('hub:member:joined', async ({ db, hubId, userId }) => {
    // Welcome email, CRM sync, etc.
  });
});
```

That's it. The plugin runs once at startup. Your handlers are called automatically whenever the corresponding event fires.

## Available Events

### Content

| Event | Payload | When |
|-------|---------|------|
| `content:published` | `{ db, contentId, authorId, contentType, slug }` | Content status changed to published |
| `content:updated` | `{ db, contentId, authorId }` | Content was updated |
| `content:deleted` | `{ db, contentId, authorId }` | Content was deleted or unpublished |
| `content:liked` | `{ db, contentId, userId }` | User liked content |
| `content:unliked` | `{ db, contentId, userId }` | User unliked content |

### Comments

| Event | Payload | When |
|-------|---------|------|
| `comment:created` | `{ db, commentId, authorId, targetType, targetId }` | New comment posted |

### Hubs

| Event | Payload | When |
|-------|---------|------|
| `hub:post:created` | `{ db, postId, hubId, authorId, postType }` | New hub post created |
| `hub:member:joined` | `{ db, hubId, userId, role }` | User joined a hub |
| `hub:member:left` | `{ db, hubId, userId }` | User left a hub |
| `hub:content:shared` | `{ db, hubId, contentId, userId }` | Content shared to a hub |

### Users

| Event | Payload | When |
|-------|---------|------|
| `user:registered` | `{ db, userId, username, email }` | New user registered |

### Federation

| Event | Payload | When |
|-------|---------|------|
| `federation:content:received` | `{ db, federatedContentId, objectUri, actorUri, originDomain, apType, cpubType }` | Federated content arrived from remote instance |
| `federation:hub:post:received` | `{ db, federatedHubPostId, federatedHubId, actorUri, postType }` | Federated hub post ingested |

## Usage Patterns

### Custom Database Tables

You can combine hooks with custom Drizzle tables to extend CommonPub's data model:

```ts
// server/schema/analytics.ts
import { pgTable, uuid, varchar, timestamp, integer } from 'drizzle-orm/pg-core';
import { contentItems } from '@commonpub/schema';

export const contentAnalytics = pgTable('content_analytics', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentId: uuid('content_id').notNull().references(() => contentItems.id, { onDelete: 'cascade' }),
  publishedContentType: varchar('published_content_type', { length: 32 }),
  viewsAtPublish: integer('views_at_publish').default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow(),
});
```

```ts
// drizzle.config.ts — include both CommonPub and custom schemas
export default defineConfig({
  schema: [
    './node_modules/@commonpub/schema/dist/*.js',
    './server/schema/*.ts',
  ],
  // ...
});
```

```ts
// server/plugins/analytics-hooks.ts
import { onHook } from '@commonpub/server';
import { contentAnalytics } from '../schema/analytics';

export default defineNitroPlugin(() => {
  onHook('content:published', async ({ db, contentId, contentType }) => {
    await db.insert(contentAnalytics).values({
      contentId,
      publishedContentType: contentType,
    }).onConflictDoNothing();
  });
});
```

Then `pnpm db:push` creates both CommonPub tables and your custom tables.

### External Integrations

```ts
// server/plugins/slack-hooks.ts
import { onHook } from '@commonpub/server';

export default defineNitroPlugin(() => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  onHook('content:published', async ({ contentType, slug }) => {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `New ${contentType} published: ${slug}`,
      }),
    });
  });

  onHook('hub:member:joined', async ({ db, hubId, userId }) => {
    // Look up names for a richer notification
    const hub = await db.select({ name: hubs.name }).from(hubs).where(eq(hubs.id, hubId)).limit(1);
    await fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ text: `New member joined ${hub[0]?.name}` }),
    });
  });
});
```

### Federation Reactions

```ts
// server/plugins/federation-hooks.ts
import { onHook } from '@commonpub/server';

export default defineNitroPlugin(() => {
  onHook('federation:content:received', async ({ originDomain, apType, cpubType }) => {
    console.log(`Received ${cpubType ?? apType} from ${originDomain}`);
    // Auto-moderate, enrich metadata, trigger search indexing, etc.
  });
});
```

## Error Handling

Each hook handler is individually wrapped in try-catch. If one handler throws, the error is logged but:
- The main operation still completes
- Other handlers still run
- The HTTP response is not affected

```ts
onHook('content:published', async () => {
  throw new Error('Slack is down');
  // Logged as: [hooks] Error in 'content:published' handler: Slack is down
  // Content still publishes successfully
});
```

## API Reference

```ts
import { onHook, emitHook, clearHooks, hookCount } from '@commonpub/server';
import type { HookPayloads, HookEvent, HookHandler } from '@commonpub/server';

// Register a handler (call in Nitro plugin at startup)
onHook(event: HookEvent, handler: HookHandler<E>): void

// Emit an event (called internally by CommonPub — you usually don't need this)
emitHook(event: HookEvent, payload: HookPayloads[E]): Promise<number>

// Remove all handlers (for testing)
clearHooks(): void

// Count handlers for an event (for diagnostics)
hookCount(event: HookEvent): number
```

## Notes

- Hooks are **awaited** — if you need fire-and-forget, wrap your handler in a `setTimeout` or use a queue
- The `db` in the payload is the same database instance used by the main operation — you can do transactional work
- Hooks run **after** the main operation, not before — there's no way to cancel an operation via a hook
- Register hooks in `server/plugins/` files — they run once at app startup
