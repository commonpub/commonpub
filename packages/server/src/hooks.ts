/**
 * CommonPub Hook System
 *
 * Lets consumer apps react to lifecycle events without modifying core code.
 * Hooks are registered once at startup (via a Nitro plugin) and called by
 * server functions after operations complete.
 *
 * Usage in consumer apps:
 *
 * ```ts
 * // server/plugins/my-hooks.ts
 * import { onHook } from '@commonpub/server';
 *
 * export default defineNitroPlugin(() => {
 *   onHook('content:published', async ({ db, contentId }) => {
 *     // Your custom logic here
 *   });
 *
 *   onHook('hub:member:joined', async ({ db, hubId, userId }) => {
 *     // Sync to external CRM, send Slack notification, etc.
 *   });
 * });
 * ```
 *
 * Hooks are awaited but individually wrapped in try-catch — one failing
 * hook does not break the main operation or other hooks.
 */
import type { DB } from './types.js';

// --- Event Payload Types ---

export interface HookPayloads {
  /** Fired after content is published (status → published) */
  'content:published': {
    db: DB;
    contentId: string;
    authorId: string;
    contentType: string;
    slug: string;
  };

  /** Fired after content is updated */
  'content:updated': {
    db: DB;
    contentId: string;
    authorId: string;
  };

  /** Fired after content is deleted or unpublished */
  'content:deleted': {
    db: DB;
    contentId: string;
    authorId: string;
  };

  /** Fired after a user likes content */
  'content:liked': {
    db: DB;
    contentId: string;
    userId: string;
  };

  /** Fired after a user unlikes content */
  'content:unliked': {
    db: DB;
    contentId: string;
    userId: string;
  };

  /** Fired after a comment is created */
  'comment:created': {
    db: DB;
    commentId: string;
    authorId: string;
    targetType: string;
    targetId: string;
  };

  /** Fired after a user creates a new hub post */
  'hub:post:created': {
    db: DB;
    postId: string;
    hubId: string;
    authorId: string;
    postType: string;
  };

  /** Fired after a user joins a hub */
  'hub:member:joined': {
    db: DB;
    hubId: string;
    userId: string;
    role: string;
  };

  /** Fired after a user leaves a hub */
  'hub:member:left': {
    db: DB;
    hubId: string;
    userId: string;
  };

  /** Fired after a new user registers */
  'user:registered': {
    db: DB;
    userId: string;
    username: string;
    email: string;
  };

  /** Fired after federated content is received from a remote instance */
  'federation:content:received': {
    db: DB;
    federatedContentId: string;
    objectUri: string;
    actorUri: string;
    originDomain: string;
    apType: string;
    cpubType: string | null;
  };

  /** Fired after a federated hub post is ingested */
  'federation:hub:post:received': {
    db: DB;
    federatedHubPostId: string;
    federatedHubId: string;
    actorUri: string;
    postType: string;
  };

  /** Fired after content is shared to a hub */
  'hub:content:shared': {
    db: DB;
    hubId: string;
    contentId: string;
    userId: string;
  };
}

export type HookEvent = keyof HookPayloads;
export type HookHandler<E extends HookEvent> = (payload: HookPayloads[E]) => Promise<void> | void;

// --- Registry ---

const registry = new Map<string, Array<(payload: unknown) => Promise<void> | void>>();

/**
 * Register a hook handler for a lifecycle event.
 * Call this in a Nitro plugin at app startup.
 *
 * Handlers are called in registration order after the main operation completes.
 * Each handler is wrapped in try-catch — failures are logged but don't break
 * the main operation or other handlers.
 *
 * @example
 * ```ts
 * import { onHook } from '@commonpub/server';
 *
 * onHook('content:published', async ({ db, contentId, contentType }) => {
 *   if (contentType === 'project') {
 *     await notifySlack(`New project published: ${contentId}`);
 *   }
 * });
 * ```
 */
export function onHook<E extends HookEvent>(
  event: E,
  handler: HookHandler<E>,
): void {
  const handlers = registry.get(event) ?? [];
  handlers.push(handler as (payload: unknown) => Promise<void> | void);
  registry.set(event, handlers);
}

/**
 * Emit a lifecycle event, calling all registered handlers.
 * Called internally by CommonPub server functions — not typically called by consumers.
 *
 * Handlers run sequentially and are individually try-caught.
 * Returns the count of handlers that executed successfully.
 */
export async function emitHook<E extends HookEvent>(
  event: E,
  payload: HookPayloads[E],
): Promise<number> {
  const handlers = registry.get(event);
  if (!handlers || handlers.length === 0) return 0;

  let succeeded = 0;
  for (const handler of handlers) {
    try {
      await handler(payload);
      succeeded++;
    } catch (err) {
      console.error(
        `[hooks] Error in '${event}' handler:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return succeeded;
}

/**
 * Remove all registered hooks. Primarily for testing.
 */
export function clearHooks(): void {
  registry.clear();
}

/**
 * Get the number of registered handlers for an event. For diagnostics.
 */
export function hookCount(event: HookEvent): number {
  return registry.get(event)?.length ?? 0;
}
