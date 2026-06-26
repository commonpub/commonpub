import { listBroadcasts } from '@commonpub/server';
import type { BroadcastSummary } from '@commonpub/server';

/** GET /api/admin/broadcast — recent broadcasts (admin history list). */
export default defineEventHandler(async (event): Promise<BroadcastSummary[]> => {
  requireFeature('admin');
  requirePermission(event, 'broadcast.send');
  return await listBroadcasts(useDB(), 20);
});
