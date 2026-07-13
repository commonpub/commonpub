import { listEvents, canReadHubById } from '@commonpub/server';
import type { EventStatus } from '@commonpub/server';

const PUBLIC_STATUSES = new Set<string>(['published', 'active', 'completed']);

/**
 * GET /api/events
 * List published/active events (public).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const db = useDB();
  const query = getQuery(event);
  const user = getOptionalUser(event);

  // Only allow public-safe status values; ignore anything else
  const rawStatus = query.status as string | undefined;
  const status = rawStatus && PUBLIC_STATUSES.has(rawStatus) ? (rawStatus as EventStatus) : undefined;

  // "My Events" filter: only allowed for the authenticated user's own ID
  let userId: string | undefined;
  if (query.myEvents === 'true' && user?.id) {
    userId = user.id;
  }

  // hubId feeds a uuid SQL bind; reject a malformed value at the door (a
  // non-uuid string reaching the bind throws an unhandled 500).
  const hubId = (query.hubId as string) || undefined;
  if (hubId && !isUuid(hubId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid hubId' });
  }

  // A `?hubId=<private hub>` events query must not enumerate a private hub's events
  // for a non-member (P-1b). Return empty (not 403) so the private hub's existence
  // isn't confirmed. (The bare feed intermixing private-hub events is a separate
  // residual — see plan; it needs a join-based exclusion in listEvents.)
  if (hubId) {
    const canRead = await canReadHubById(db, hubId, user?.id, {
      asPlatformAdmin: hasPermission(event, 'admin.access'),
    });
    if (!canRead) return { items: [], total: 0 };
  }

  return listEvents(db, {
    status,
    hubId,
    upcoming: query.upcoming === 'true',
    featured: query.featured === 'true',
    userId,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
