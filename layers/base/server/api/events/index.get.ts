import { listEvents, canReadHubById, toPageMeta, normalizePagination } from '@commonpub/server';
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
    if (!canRead) return { items: [], total: 0, hasMore: false };
  }

  // Normalise with the SAME helper listEvents uses. This route takes a raw
  // Number() with no schema, so `?limit=500` would otherwise leave the route
  // comparing against 500 while the helper clamped to 100: `returned === limit`
  // goes false, hasMore goes false, and the pager disappears again. `?limit=abc`
  // is worse, since NaN fails every comparison. One implementation, not two.
  const { limit, offset } = normalizePagination({
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    offset: query.offset !== undefined ? Number(query.offset) : undefined,
  });
  const result = await listEvents(db, {
    status,
    hubId,
    upcoming: query.upcoming === 'true',
    featured: query.featured === 'true',
    userId,
    limit,
    offset,
  });
  // Translate the skipped-count sentinel before it reaches the page, which
  // binds its pager to `total` and would drop Previous as well as Next.
  return { ...result, ...toPageMeta({ total: result.total, returned: result.items.length, limit, offset }) };
});
