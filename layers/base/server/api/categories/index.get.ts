import { listContentCategories } from '@commonpub/server';

/**
 * GET /api/categories
 * List all content categories (public).
 */
export default defineEventHandler(async () => {
  const db = useDB();
  return listContentCategories(db);
});
