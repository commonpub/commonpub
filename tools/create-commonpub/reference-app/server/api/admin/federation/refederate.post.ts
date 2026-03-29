import { contentItems } from '@commonpub/schema';
import { federateContent } from '@commonpub/server';
import { eq } from 'drizzle-orm';
import { extractDomain } from '../../../utils/inbox';

/**
 * POST /api/admin/federation/refederate
 * Queue all published content for federation delivery.
 * Useful after establishing new mirrors or enabling federation.
 *
 * Body: { contentId?: string } — if omitted, re-federates ALL published content
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const body = await readBody(event);
  const contentId = body?.contentId as string | undefined;

  const db = useDB();
  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);

  if (contentId) {
    await federateContent(db, contentId, domain);
    return { queued: 1 };
  }

  // Re-federate all published content
  const published = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(eq(contentItems.status, 'published'));

  let queued = 0;
  for (const item of published) {
    try {
      await federateContent(db, item.id, domain);
      queued++;
    } catch {
      // Skip items that fail (e.g., missing author)
    }
  }

  return { queued, total: published.length };
});
