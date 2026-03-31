import { getPlatformStats } from '@commonpub/server';
import type { PlatformStats } from '@commonpub/server';

export default defineEventHandler(async (_event): Promise<PlatformStats> => {
  const db = useDB();
  const stats = await getPlatformStats(db);
  return stats;
});
