import { repairFederatedContentTypes } from '@commonpub/server';

/**
 * POST /api/admin/federation/repair-types
 * Re-fetches source objects for federated content with missing cpubType
 * and updates them based on the cpub:type extension field.
 */
export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();

  return repairFederatedContentTypes(db);
});
