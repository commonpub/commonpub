import { removeContentProduct } from '@commonpub/server';
import { eq, and } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ removed: boolean }> => {
  const db = useDB();
  const user = requireAuth(event);
  const { id, productId } = parseParams(event, { id: 'uuid', productId: 'uuid' });

  // Ownership check
  const [content] = await db
    .select({ authorId: contentItems.authorId })
    .from(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.authorId, user.id)))
    .limit(1);

  if (!content) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to modify this content' });
  }

  const removed = await removeContentProduct(db, id, productId);

  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Product link not found' });
  }

  return { removed: true };
});
