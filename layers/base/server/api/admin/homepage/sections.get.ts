import { getHomepageSections } from '@commonpub/server';

/**
 * GET /api/admin/homepage/sections
 * Returns homepage sections for admin editing.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'layout.manage');
  const db = useDB();
  return getHomepageSections(db);
});
