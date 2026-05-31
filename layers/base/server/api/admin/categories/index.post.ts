import { createContentCategory } from '@commonpub/server';
import { createContentCategorySchema } from '@commonpub/schema';

/**
 * POST /api/admin/categories
 * Create a new content category (admin only).
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'categories.manage');
  const db = useDB();
  const body = await parseBody(event, createContentCategorySchema);
  return createContentCategory(db, body);
});
