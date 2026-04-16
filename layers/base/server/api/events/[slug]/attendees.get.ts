import { getEventBySlug, listEventAttendees } from '@commonpub/server';
import type { AttendeeStatus } from '@commonpub/server';

/**
 * GET /api/events/:slug/attendees
 * List attendees for an event (public).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const existing = await getEventBySlug(db, slug);
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Event not found' });

  const query = getQuery(event);
  return listEventAttendees(db, existing.id, {
    status: (query.status as AttendeeStatus) || undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    offset: query.offset ? Number(query.offset) : undefined,
  });
});
