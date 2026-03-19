import { removeContentProduct } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ removed: boolean }> => {
  const db = useDB();
  requireAuth(event);
  const id = getRouterParam(event, 'id');
  const productId = getRouterParam(event, 'productId');

  if (!id || !productId) {
    throw createError({ statusCode: 400, statusMessage: 'Content ID and Product ID are required' });
  }

  const removed = await removeContentProduct(db, id, productId);

  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Product link not found' });
  }

  return { removed: true };
});
