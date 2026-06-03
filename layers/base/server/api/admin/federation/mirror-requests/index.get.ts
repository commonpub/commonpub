import { listMirrorRequests } from '@commonpub/server';

/**
 * GET /api/admin/federation/mirror-requests
 * Consent-based mirror requests (Phase 3), grouped by direction:
 *  - `incoming` — instances asking US to mirror them (approve/reject in the admin UI)
 *  - `outgoing` — instances WE asked to mirror us (track approval status)
 * Admin only.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requirePermission(event, 'federation.manage');
  const db = useDB();

  const [incoming, outgoing] = await Promise.all([
    listMirrorRequests(db, 'incoming'),
    listMirrorRequests(db, 'outgoing'),
  ]);

  return { incoming, outgoing };
});
