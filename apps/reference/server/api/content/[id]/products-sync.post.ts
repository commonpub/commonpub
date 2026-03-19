import { syncContentProducts } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentProductItem[]> => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Content ID is required' });
  }

  const body = await readBody(event);

  if (!Array.isArray(body?.items)) {
    throw createError({ statusCode: 400, statusMessage: 'items array is required' });
  }

  return syncContentProducts(db, id, body.items);
});
