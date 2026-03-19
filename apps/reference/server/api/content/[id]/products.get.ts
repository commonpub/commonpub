import { listContentProducts } from '@commonpub/server';
import type { ContentProductItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentProductItem[]> => {
  const db = useDB();
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Content ID is required' });
  }

  return listContentProducts(db, id);
});
