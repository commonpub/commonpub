import { listRegistryInstances } from '@commonpub/server';
import { registryInstanceQuerySchema } from '@commonpub/schema';

/**
 * GET /api/admin/registry/instances (Phase 4)
 * Admin view of the registry directory — ALL entries incl. hidden/blocked, with status.
 * Admin only.
 */
export default defineEventHandler(async (event) => {
  requireFeature('actAsRegistry');
  requirePermission(event, 'federation.manage');
  const q = registryInstanceQuerySchema.parse(getQuery(event));
  return listRegistryInstances(useDB(), {
    search: q.search,
    limit: q.limit,
    offset: q.offset,
    includeNonActive: true,
  });
});
