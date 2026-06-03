import { listRegistryInstances, type RegistryInstanceView } from '@commonpub/server';
import { registryInstanceQuerySchema } from '@commonpub/schema';

/**
 * GET /api/registry/instances (Phase 4)
 * Public directory of CommonPub instances registered with this registry. Gated on
 * `features.actAsRegistry`. Returns ACTIVE entries only, through an explicit allow-list (no
 * internal id/status). Other instances/clients can consume this to discover peers.
 */
function toPublicRegistryInstance(v: RegistryInstanceView) {
  return {
    domain: v.domain,
    actorUri: v.actorUri,
    name: v.name,
    description: v.description,
    userCount: v.userCount,
    activeMonthCount: v.activeMonthCount,
    localPostCount: v.localPostCount,
    features: v.features,
    softwareName: v.softwareName,
    softwareVersion: v.softwareVersion,
    online: v.online,
    lastPingAt: v.lastPingAt,
  };
}

export default defineEventHandler(async (event) => {
  requireFeature('actAsRegistry');
  const q = registryInstanceQuerySchema.parse(getQuery(event));
  const { instances, total } = await listRegistryInstances(useDB(), {
    search: q.search,
    limit: q.limit,
    offset: q.offset,
    includeNonActive: false,
  });
  return { instances: instances.map(toPublicRegistryInstance), total, limit: q.limit, offset: q.offset };
});
