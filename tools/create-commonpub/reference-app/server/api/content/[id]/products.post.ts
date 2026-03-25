import { addContentProduct } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';
import { addContentProductSchema } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';
import { contentItems } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContentProductItem> => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, addContentProductSchema);

  // Ownership check
  const [content] = await db
    .select({ authorId: contentItems.authorId })
    .from(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.authorId, user.id)))
    .limit(1);

  if (!content) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to modify this content' });
  }

  const result = await addContentProduct(db, id, input);

  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found or already linked' });
  }

  return result;
});
