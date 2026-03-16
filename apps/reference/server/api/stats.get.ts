import { getPlatformStats } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const stats = await getPlatformStats(db);
  return stats;
});
