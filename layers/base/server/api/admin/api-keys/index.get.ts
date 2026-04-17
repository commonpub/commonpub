import { listApiKeys } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const query = getQuery(event);
  const includeRevoked = query.includeRevoked === 'true' || query.includeRevoked === '1';
  const db = useDB();
  const items = await listApiKeys(db, { includeRevoked });
  return { items, total: items.length };
});
