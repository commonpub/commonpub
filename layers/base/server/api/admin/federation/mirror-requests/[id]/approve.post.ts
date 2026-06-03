import { approveMirrorRequest } from '@commonpub/server';
import { approveMirrorRequestSchema } from '@commonpub/schema';

/**
 * POST /api/admin/federation/mirror-requests/[id]/approve
 * Approve an incoming mirror request: create a pull mirror of the requester using the approver's
 * own bounded depth + filters, then Accept the request. Body (all optional):
 *  { sinceDays?, maxItems?, filterContentTypes?, filterTags? } — absent depth = forward-only.
 * Admin only.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requirePermission(event, 'federation.manage');

  const { id } = parseParams(event, { id: 'uuid' });
  const body = await parseBody(event, approveMirrorRequestSchema.optional()).catch(() => ({}));
  const config = useConfig();

  return approveMirrorRequest(useDB(), id, config.instance.domain, body ?? {});
});
