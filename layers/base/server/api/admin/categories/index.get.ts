import { listContentCategories } from '@commonpub/server';

/**
 * GET /api/admin/categories
 * List all content categories (admin).
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'categories.manage');
  const db = useDB();
  return listContentCategories(db);
});
