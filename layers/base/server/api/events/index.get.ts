import { listEvents } from '@commonpub/server';
import type { EventStatus } from '@commonpub/server';

/**
 * GET /api/events
 * List published/active events (public).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const db = useDB();
  const query = getQuery(event);

  return listEvents(db, {
    status: (query.status as EventStatus) || undefined,
    hubId: (query.hubId as string) || undefined,
    upcoming: query.upcoming === 'true',
    featured: query.featured === 'true',
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
