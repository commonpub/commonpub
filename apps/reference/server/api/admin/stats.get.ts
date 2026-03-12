import { getPlatformStats } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const db = useDB();
  return getPlatformStats(db);
});
