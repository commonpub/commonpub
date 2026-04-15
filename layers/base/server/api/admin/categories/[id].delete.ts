import { deleteContentCategory } from '@commonpub/server';

/**
 * DELETE /api/admin/categories/[id]
 * Delete a content category (admin only). System categories cannot be deleted.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  const result = await deleteContentCategory(db, id);
  if (!result.deleted) {
    if (result.error === 'system_category') {
      throw createError({ statusCode: 403, statusMessage: 'System categories cannot be deleted' });
    }
    throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  }
  return { success: true };
});
