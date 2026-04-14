import { syncContentProducts } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';
import { eq, and } from 'drizzle-orm';
import { contentItems, addContentProductSchema } from '@commonpub/schema';
import { z } from 'zod';

const productsSyncSchema = z.object({
  items: z.array(addContentProductSchema),
});

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

  const body = await parseBody(event, productsSyncSchema);

  return syncContentProducts(db, id, body.items);
});
