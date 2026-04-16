import { getNavItems } from '@commonpub/server';

/**
 * GET /api/admin/navigation/items
 * Returns navigation items for admin editing.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  return getNavItems(db);
});
