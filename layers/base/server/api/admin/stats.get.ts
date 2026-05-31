import { getPlatformStats } from '@commonpub/server';
import type { PlatformStats } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<PlatformStats> => {
  requireFeature('admin');
  requirePermission(event, 'audit.read');
  const db = useDB();
  return getPlatformStats(db);
});
