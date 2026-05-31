import { getNavItems } from '@commonpub/server';

/**
 * GET /api/admin/navigation/items
 * Returns navigation items for admin editing.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'navigation.manage');
  const db = useDB();
  return getNavItems(db);
});
