import { deleteProduct } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ deleted: boolean }> => {
  const db = useDB();
  requireAdmin(event);
  const { id } = parseParams(event, { id: 'uuid' });

  const deleted = await deleteProduct(db, id);

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  return { deleted: true };
});
