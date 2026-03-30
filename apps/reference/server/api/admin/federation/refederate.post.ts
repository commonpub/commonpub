import { contentItems, hubs, hubPosts } from '@commonpub/schema';
import { federateContent, federateHubPost } from '@commonpub/server';
import { eq, isNull } from 'drizzle-orm';
import { extractDomain } from '../../../utils/inbox';

/**
 * POST /api/admin/federation/refederate
 * Queue all published content AND hub posts for federation delivery.
 * Useful after establishing new mirrors or enabling federation.
 *
 * Body: { contentId?: string, hubsOnly?: boolean } — if omitted, re-federates ALL
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const body = await readBody(event);
  const contentId = body?.contentId as string | undefined;
  const hubsOnly = body?.hubsOnly === true;

  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);

  if (contentId) {
    await federateContent(db, contentId, domain);
    return { queued: 1 };
  }

  let contentQueued = 0;
  let hubPostsQueued = 0;

  // Re-federate published content (unless hubsOnly)
  if (!hubsOnly) {
    const published = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(eq(contentItems.status, 'published'));

    for (const item of published) {
      try {
        await federateContent(db, item.id, domain);
        contentQueued++;
      } catch {
        // Skip items that fail
      }
    }
  }

  // Re-federate hub posts (Announce activities from Group actors)
  if (config.features.federateHubs) {
    const allHubs = await db
      .select({ id: hubs.id })
      .from(hubs)
      .where(isNull(hubs.deletedAt));

    for (const hub of allHubs) {
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
    queued: contentQueued + hubPostsQueued,
    content: contentQueued,
    hubPosts: hubPostsQueued,
  };
});
