import { setRegistryInstanceStatus } from '@commonpub/server';
import { setRegistryInstanceStatusSchema } from '@commonpub/schema';

/**
 * POST /api/admin/registry/instances/[id]/status (Phase 4)
 * Admin sets a directory entry's status: active (visible) | hidden (tracked, not shown) |
 * blocked (future pings ignored). Admin only.
 */
export default defineEventHandler(async (event) => {
  requireFeature('actAsRegistry');
  requirePermission(event, 'federation.manage');
  const { id } = parseParams(event, { id: 'uuid' });
  const { status } = await parseBody(event, setRegistryInstanceStatusSchema);

  const updated = await setRegistryInstanceStatus(useDB(), id, status);
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Instance not found' });
  return updated;
});
