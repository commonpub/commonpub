/**
 * Outbox backfill — crawls a remote instance's outbox to import historical content.
 * Supports resume via cursor stored in instanceMirrors.backfillCursor.
 */
import { eq } from 'drizzle-orm';
import { instanceMirrors } from '@commonpub/schema';
import { resolveActor, processInboxActivity } from '@commonpub/protocol';
import type { DB } from '../types.js';
import { createInboxHandlers } from './inboxHandlers.js';

const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_PAGES_MS = 1_000;

export interface BackfillResult {
  processed: number;
  errors: number;
  pages: number;
  /** Whether backfill completed (reached end of outbox or maxItems) */
  complete: boolean;
}

export interface BackfillOptions {
  /** Maximum items to process (default 500) */
  maxItems?: number;
  /** Mirror ID — if provided, saves cursor for resume and checks quota */
  mirrorId?: string;
}

/**
 * Crawl a remote instance actor's outbox and process historical Create activities.
 * Supports resume: if mirrorId is provided, saves progress cursor after each page
 * and resumes from the cursor on subsequent calls.
 */
export async function backfillFromOutbox(
  db: DB,
  remoteActorUri: string,
  domain: string,
  maxItemsOrOpts?: number | BackfillOptions,
): Promise<BackfillResult> {
  const opts = typeof maxItemsOrOpts === 'number'
    ? { maxItems: maxItemsOrOpts }
    : maxItemsOrOpts ?? {};
  const maxItems = opts.maxItems ?? 500;
  const mirrorId = opts.mirrorId;

  const result: BackfillResult = { processed: 0, errors: 0, pages: 0, complete: false };

  // Check for saved cursor (resume from where we left off)
  let startUrl: string | null = null;
  if (mirrorId) {
    const [mirror] = await db
      .select({ backfillCursor: instanceMirrors.backfillCursor })
      .from(instanceMirrors)
      .where(eq(instanceMirrors.id, mirrorId))
      .limit(1);
    if (mirror?.backfillCursor) {
      startUrl = mirror.backfillCursor;
    }
  }

  // If no cursor, resolve the remote actor's outbox URL
  if (!startUrl) {
    const actor = await resolveActor(remoteActorUri, fetch);
    if (!actor?.outbox) {
      throw new Error(`Could not resolve outbox for ${remoteActorUri}`);
    }
    startUrl = actor.outbox;
  }

  const handlers = createInboxHandlers({ db, domain });
  let nextPage: string | null = startUrl;

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
        const firstPage = collection.first as string | Record<string, unknown> | undefined;
        if (typeof firstPage === 'string') {
          nextPage = firstPage;
          continue;
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
        break;
      }

      // Process each activity (per-item error handling — one bad item doesn't stop the page)
      for (const item of items) {
        if (result.processed >= maxItems) break;

        const activity = item as Record<string, unknown>;
        if (!activity || typeof activity !== 'object') continue;

        // Process Create, Update, and Announce activities (not Follow, Like, etc.)
        // Announce is needed for hub post backfill from Group actors
        if (activity.type !== 'Create' && activity.type !== 'Update' && activity.type !== 'Announce') continue;

        try {
          await processInboxActivity(activity, handlers);
          result.processed++;
        } catch {
          result.errors++;
          // Continue processing remaining items on this page
        }
      }

      // Save cursor after each page (for resume on crash/restart)
      if (mirrorId && next) {
        await db
          .update(instanceMirrors)
          .set({ backfillCursor: next, updatedAt: new Date() })
          .where(eq(instanceMirrors.id, mirrorId));
      }

      nextPage = next;

      // Rate limit: don't hammer the remote server
      if (nextPage) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
      }
    } catch {
      result.errors++;
      // Network error on this page — save cursor and stop
      // Next backfill call will resume from this point
      break;
    }
  }

  // Mark complete if we exhausted the outbox or hit maxItems
  result.complete = !nextPage || result.processed >= maxItems;

  // Clear cursor if backfill is complete
  if (mirrorId && result.complete) {
    await db
      .update(instanceMirrors)
      .set({ backfillCursor: null, updatedAt: new Date() })
      .where(eq(instanceMirrors.id, mirrorId));
  }

  return result;
}
