import { getHomepageSections } from '@commonpub/server';

/**
 * GET /api/homepage/sections
 * Returns the homepage section configuration (public).
 */
export default defineEventHandler(async () => {
  const db = useDB();
  return getHomepageSections(db);
});
