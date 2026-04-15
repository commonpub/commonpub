import { updateContentCategory } from '@commonpub/server';
import { updateContentCategorySchema } from '@commonpub/schema';

/**
 * PATCH /api/admin/categories/[id]
 * Update a content category (admin only).
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });
  const body = await parseBody(event, updateContentCategorySchema);

  const result = await updateContentCategory(db, id, body);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  }
  return result;
});
