import { syncContentProducts } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';
import { eq, and } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContentProductItem[]> => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });

  // Ownership check
  const [content] = await db
    .select({ authorId: contentItems.authorId })
    .from(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.authorId, user.id)))
    .limit(1);

  if (!content) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to modify this content' });
  }

  const body = await readBody(event);

  if (!Array.isArray(body?.items)) {
    throw createError({ statusCode: 400, statusMessage: 'items array is required' });
  }

  return syncContentProducts(db, id, body.items);
});
