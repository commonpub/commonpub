import { deleteVideoCategory } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireAdmin(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Category ID required' });
  }

  const db = useDB();
  const deleted = await deleteVideoCategory(db, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  }

  return { success: true };
});
