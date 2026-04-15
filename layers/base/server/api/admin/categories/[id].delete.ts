import { deleteContentCategory } from '@commonpub/server';

/**
 * DELETE /api/admin/categories/[id]
 * Delete a content category (admin only). System categories cannot be deleted.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  const deleted = await deleteContentCategory(db, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  }
  return { success: true };
});
