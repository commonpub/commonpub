import { addContentProduct } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';
import { addContentProductSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<ContentProductItem> => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Content ID is required' });
  }

  const body = await readBody(event);
  const parsed = addContentProductSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input', data: parsed.error.flatten() });
  }

  const result = await addContentProduct(db, id, parsed.data);

  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found or already linked' });
  }

  return result;
});
