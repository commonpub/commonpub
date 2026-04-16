import { listEvents } from '@commonpub/server';
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

  return listEvents(db, {
    status,
    hubId: (query.hubId as string) || undefined,
    upcoming: query.upcoming === 'true',
    featured: query.featured === 'true',
    userId,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
