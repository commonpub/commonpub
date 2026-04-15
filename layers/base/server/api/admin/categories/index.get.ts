import { listContentCategories } from '@commonpub/server';

/**
 * GET /api/admin/categories
 * List all content categories (admin).
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  return listContentCategories(db);
});
