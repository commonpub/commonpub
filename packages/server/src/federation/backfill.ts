/**
 * Outbox backfill — crawls a remote instance's outbox to import historical content.
 * Supports resume via cursor stored in instanceMirrors.backfillCursor.
 */
import { eq } from 'drizzle-orm';
import { instanceMirrors } from '@commonpub/schema';
import { resolveActor, processInboxActivity, safeFetchResponse, safeFetchSigned, type SafeFetchResponseResult } from '@commonpub/protocol';
import type { DB } from '../types.js';
import { createInboxHandlers } from './inboxHandlers.js';
import { createSafeActorFetchFn } from './safeFetchFn.js';

const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_PAGES_MS = 1_000;

/**
 * Perform a signed HTTP GET for ActivityPub resources through the SSRF-safe
 * dispatcher (federation-hardening Item 4). Uses the instance actor keypair
 * for HTTP Signature authentication. Falls back to an unsigned safe fetch
 * if keypair generation fails (still SSRF-protected).
 *
 * Returns the buffered response shape; callers parse the body themselves
 * and inspect `ok`/`status` for federation-side flow control.
 */
async function signedGet(db: DB, url: string, domain: string): Promise<SafeFetchResponseResult> {
  try {
    const { getOrCreateInstanceKeypair } = await import('./federation.js');
    const { signRequest } = await import('@commonpub/protocol');
    const keypair = await getOrCreateInstanceKeypair(db);
    const keyId = `https://${domain}/actor#main-key`;

    const request = new Request(url, {
      method: 'GET',
      headers: {
        Accept: 'application/activity+json, application/ld+json',
        'User-Agent': `CommonPub/1.0 (+https://${domain})`,
      },
    });

    const signed = await signRequest(request, keypair.privateKeyPem, keyId);
    return await safeFetchSigned(signed, { timeoutMs: FETCH_TIMEOUT_MS });
  } catch {
    // Fall back to unsigned safeFetchResponse (works for public outboxes;
    // still SSRF-protected by the pinned dispatcher).
    return safeFetchResponse(url, {
      accept: 'application/activity+json, application/ld+json',
      userAgent: `CommonPub/1.0 (+https://${domain})`,
      timeoutMs: FETCH_TIMEOUT_MS,
    });
  }
}

export interface BackfillResult {
  processed: number;
  errors: number;
  pages: number;
  /** Whether backfill completed (reached end of outbox or maxItems) */
  complete: boolean;
}

export interface BackfillOptions {
  /** Maximum items to process (default 500). Hard ceiling on how many historical items to pull. */
  maxItems?: number;
  /**
   * Only import items published on/after this date. The outbox is newest-first, so once we
   * page past the cutoff we stop crawling entirely. Lets an operator pick "how far back"
   * (e.g. last 30 days) instead of pulling an instance's entire history.
   */
  since?: Date;
  /** Mirror ID — if provided, saves cursor for resume and checks quota */
  mirrorId?: string;
}

/** Best-effort publish timestamp (ms) of an AP activity, top-level `published` or `object.published`. */
export function activityPublishedMs(a: Record<string, unknown>): number | null {
  if (typeof a.published === 'string') {
    const t = Date.parse(a.published);
    if (!Number.isNaN(t)) return t;
  }
  const obj = a.object;
  if (obj && typeof obj === 'object') {
    const p = (obj as Record<string, unknown>).published;
    if (typeof p === 'string') {
      const t = Date.parse(p);
      if (!Number.isNaN(t)) return t;
    }
  }
  return null;
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
  const sinceMs = opts.since ? opts.since.getTime() : null;

  const result: BackfillResult = { processed: 0, errors: 0, pages: 0, complete: false };
  // Set once we page past the `since` cutoff — stops the whole crawl (outbox is newest-first).
  let reachedSince = false;

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

  // If no cursor, resolve the remote actor's outbox URL through the
  // SSRF-safe fetch (DNS-rebind protection on top of resolveActor's per-hop
  // string check — federation-hardening Item 4).
  if (!startUrl) {
    const actor = await resolveActor(remoteActorUri, createSafeActorFetchFn());
    if (!actor?.outbox) {
      throw new Error(`Could not resolve outbox for ${remoteActorUri}`);
    }
    startUrl = actor.outbox;
  }

  const handlers = createInboxHandlers({ db, domain });
  let nextPage: string | null = startUrl;

  while (nextPage && result.pages < MAX_PAGES && result.processed < maxItems) {
    try {
      const response = await signedGet(db, nextPage, domain);

      if (!response.ok) break;

      const collection = JSON.parse(response.body.toString('utf-8')) as Record<string, unknown>;
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

        // Bounded "how far back" — stop once we page past the cutoff (newest-first outbox).
        if (sinceMs !== null) {
          const ts = activityPublishedMs(activity);
          if (ts !== null && ts < sinceMs) {
            reachedSince = true;
            break;
          }
        }

        try {
          await processInboxActivity(activity, handlers);
          result.processed++;
        } catch {
          result.errors++;
          // Continue processing remaining items on this page
        }
      }

      if (reachedSince) break;

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

  // Mark complete if we exhausted the outbox, hit maxItems, or paged past the `since` cutoff
  result.complete = !nextPage || result.processed >= maxItems || reachedSince;

  // Clear cursor if backfill is complete
  if (mirrorId && result.complete) {
    await db
      .update(instanceMirrors)
      .set({ backfillCursor: null, updatedAt: new Date() })
      .where(eq(instanceMirrors.id, mirrorId));
  }

  return result;
}
