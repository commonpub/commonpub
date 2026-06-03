import { rejectMirrorRequest } from '@commonpub/server';

/**
 * POST /api/admin/federation/mirror-requests/[id]/reject
 * Reject an incoming mirror request: send Reject(Offer) to the requester; create no mirror.
 * Admin only.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requirePermission(event, 'federation.manage');

  const { id } = parseParams(event, { id: 'uuid' });
  const config = useConfig();

  return rejectMirrorRequest(useDB(), id, config.instance.domain);
});
