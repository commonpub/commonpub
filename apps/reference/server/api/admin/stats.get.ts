import { getPlatformStats } from '@commonpub/server';
import type { PlatformStats } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<PlatformStats> => {
  requireAdmin(event);
  const db = useDB();
  return getPlatformStats(db);
});
