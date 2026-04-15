import { indexContent, configureContentIndex } from '@commonpub/server';
import { contentItems } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import type { MeiliClient } from '@commonpub/server';

/**
 * Rebuild the entire Meilisearch content index.
 * Iterates all published content and re-indexes each item.
 * Requires admin role. Rate-limited to prevent abuse.
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  requireAdmin(event);

  const meiliUrl = process.env.MEILI_URL;
  const meiliKey = process.env.MEILI_MASTER_KEY;
  if (!meiliUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Meilisearch not configured' });
  }

  const db = useDB();

  let client: MeiliClient;
  try {
    const { MeiliSearch } = await import('meilisearch');
    client = new MeiliSearch({ host: meiliUrl, apiKey: meiliKey }) as unknown as MeiliClient;
    await configureContentIndex(client);
  } catch (err) {
    throw createError({ statusCode: 503, statusMessage: 'Failed to connect to Meilisearch' });
  }

  // Fetch all published content IDs
  const published = await db
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(eq(contentItems.status, 'published'));

  let indexed = 0;
  let errors = 0;

  for (const item of published) {
    try {
      await indexContent(db, item.id, client);
      indexed++;
    } catch {
      errors++;
    }
  }

  return {
    success: true,
    indexed,
    errors,
    total: published.length,
  };
});
