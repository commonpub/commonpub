/**
 * Outbox backfill — crawls a remote instance's outbox to import historical content.
 * Used when a new mirror is established to get past content, not just future.
 */
import { resolveActor } from '@commonpub/protocol';
import type { DB } from '../types.js';
import { createInboxHandlers } from './inboxHandlers.js';
import { processInboxActivity } from '@commonpub/protocol';

const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_PAGES_MS = 1_000;

export interface BackfillResult {
  processed: number;
  errors: number;
  pages: number;
}

/**
 * Crawl a remote instance actor's outbox and process historical Create activities.
 * This populates federated_content with past content from the mirrored instance.
 *
 * @param db - Database connection
 * @param remoteActorUri - The remote instance's actor URI (e.g., https://deveco.io/actor)
 * @param domain - The local instance domain
 * @param maxItems - Maximum items to process (default 500)
 */
export async function backfillFromOutbox(
  db: DB,
  remoteActorUri: string,
  domain: string,
  maxItems = 500,
): Promise<BackfillResult> {
  const result: BackfillResult = { processed: 0, errors: 0, pages: 0 };

  // Resolve the remote actor to get their outbox URL
  const actor = await resolveActor(remoteActorUri, fetch);
  if (!actor?.outbox) {
    throw new Error(`Could not resolve outbox for ${remoteActorUri}`);
  }

  const handlers = createInboxHandlers({ db, domain });
  let nextPage: string | null = actor.outbox;

  while (nextPage && result.pages < MAX_PAGES && result.processed < maxItems) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(nextPage, {
        headers: {
          Accept: 'application/activity+json, application/ld+json',
          'User-Agent': `CommonPub/1.0 (+https://${domain})`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) break;

      const collection = await response.json() as Record<string, unknown>;
      result.pages++;

      // Handle OrderedCollection (top-level) vs OrderedCollectionPage
      let items: unknown[] = [];
      let next: string | null = null;

      if (collection.type === 'OrderedCollection') {
        // Top-level collection — follow 'first' link to get actual items
        const firstPage = collection.first as string | Record<string, unknown> | undefined;
        if (typeof firstPage === 'string') {
          nextPage = firstPage;
          continue; // Fetch the first page
        } else if (firstPage && typeof firstPage === 'object') {
          items = (firstPage as Record<string, unknown>).orderedItems as unknown[] ?? [];
          next = (firstPage as Record<string, unknown>).next as string | null ?? null;
        } else {
          items = collection.orderedItems as unknown[] ?? [];
        }
      } else if (collection.type === 'OrderedCollectionPage') {
        items = collection.orderedItems as unknown[] ?? [];
        next = collection.next as string | null ?? null;
      } else {
        break; // Unknown collection type
      }

      // Process each activity
      for (const item of items) {
        if (result.processed >= maxItems) break;

        const activity = item as Record<string, unknown>;
        if (!activity || typeof activity !== 'object') continue;

        // Only process Create activities (skip Follow, Like, etc.)
        if (activity.type !== 'Create') continue;

        try {
          await processInboxActivity(activity, handlers);
          result.processed++;
        } catch {
          result.errors++;
        }
      }

      nextPage = next;

      // Rate limit: don't hammer the remote server
      if (nextPage) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
      }
    } catch {
      result.errors++;
      break; // Network error — stop crawling
    }
  }

  return result;
}
