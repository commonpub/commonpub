import { getNavItems } from '@commonpub/server';

/**
 * GET /api/navigation/items
 * Returns the navigation item configuration (public).
 */
export default defineEventHandler(async () => {
  const db = useDB();
  return getNavItems(db);
});
