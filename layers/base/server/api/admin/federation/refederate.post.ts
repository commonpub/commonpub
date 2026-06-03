import { contentItems, hubs, hubPosts } from '@commonpub/schema';
import { federateContent, federateHubPost, federateHubActor } from '@commonpub/server';
import { eq, and, gte, desc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { extractDomain } from '../../../utils/inbox';

/** Default re-federation window when neither `all` nor `since` is given — avoids a delivery storm. */
const DEFAULT_SINCE_DAYS = 30;
/** Hard cap on a bounded (non-`all`) re-federation run. */
const DEFAULT_LIMIT = 1000;

/**
 * POST /api/admin/federation/refederate
 * Re-queue published content (Create) + hub posts (Announce) for delivery to current followers.
 * Useful after establishing new mirrors or enabling federation.
 *
 * BOUNDED BY DEFAULT to avoid blasting every follower with thousands of activities:
 *  - `contentId` — re-federate a single item.
 *  - `all: true` — re-federate everything (explicit opt-in; no date/limit bound).
 *  - `sinceDays` — only items published within the last N days.
 *  - `limit` — cap the number of items.
 * With none of these, defaults to the last 30 days, capped at 1000 items, newest-first.
 * `federateContent` is idempotent (skips an already-pending Create for the same object), so
 * repeated runs don't duplicate the queue.
 */
export default defineEventHandler(async (event) => {
  // Allow CLI trigger via AUTH_SECRET header (for server-side automation)
  const cliSecret = getRequestHeader(event, 'x-admin-secret');
  const runtimeConfig = useRuntimeConfig();
  if (cliSecret && cliSecret === runtimeConfig.authSecret) {
    // Authorized via shared secret
  } else {
    requirePermission(event, 'federation.manage');
  }

  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const body = await parseBody(event, z.object({
    contentId: z.string().uuid().optional(),
    hubsOnly: z.boolean().optional(),
    all: z.boolean().optional(),
    sinceDays: z.number().int().positive().max(3650).optional(),
    limit: z.number().int().positive().max(10000).optional(),
  }));
  const contentId = body.contentId;
  const hubsOnly = body.hubsOnly === true;
  const all = body.all === true;

  const db = useDB();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);

  if (contentId) {
    await federateContent(db, contentId, domain);
    return { queued: 1 };
  }

  let contentQueued = 0;
  let hubsQueued = 0;
  let hubPostsQueued = 0;

  // Re-federate published content (unless hubsOnly), bounded unless `all` is set.
  if (!hubsOnly) {
    const since = all
      ? null
      : new Date(Date.now() - (body.sinceDays ?? DEFAULT_SINCE_DAYS) * 24 * 60 * 60 * 1000);
    const limit = all ? undefined : (body.limit ?? DEFAULT_LIMIT);

    let q = db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(
        since
          ? and(eq(contentItems.status, 'published'), gte(contentItems.publishedAt, since))
          : eq(contentItems.status, 'published'),
      )
      .orderBy(desc(contentItems.publishedAt))
      .$dynamic();
    if (limit != null) q = q.limit(limit);
    const published = await q;

    for (const item of published) {
      try {
        await federateContent(db, item.id, domain);
        contentQueued++;
      } catch {
        // Skip items that fail
      }
    }
  }

  // Re-federate hubs: announce each hub's Group actor + all hub posts
  if (config.features.federateHubs) {
    const allHubs = await db
      .select({ id: hubs.id })
      .from(hubs)
      .where(isNull(hubs.deletedAt));

    for (const hub of allHubs) {
      try {
        await federateHubActor(db, hub.id, domain);
        hubsQueued++;
      } catch {
        // Skip hubs that fail
      }

      const posts = await db
        .select({ id: hubPosts.id })
        .from(hubPosts)
        .where(eq(hubPosts.hubId, hub.id));

      for (const post of posts) {
        try {
          await federateHubPost(db, post.id, hub.id, domain);
          hubPostsQueued++;
        } catch {
          // Skip posts that fail
        }
      }
    }
  }

  return {
    queued: contentQueued + hubsQueued + hubPostsQueued,
    content: contentQueued,
    hubs: hubsQueued,
    hubPosts: hubPostsQueued,
  };
});
