import { getEventBySlug, listEventAttendees, canReadHubById, toPageMeta, normalizePagination } from '@commonpub/server';
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

  // A private-hub event's attendee roster (userName/username/avatar of every
  // registrant) is members-only (P-1b). 404 (not 403) so the slug isn't confirmed.
  if (existing.hubId) {
    const viewer = getOptionalUser(event);
    const canRead = await canReadHubById(db, existing.hubId, viewer?.id, {
      asPlatformAdmin: hasPermission(event, 'admin.access'),
    });
    if (!canRead) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  // Don't expose the attendee roster for non-published events (draft/cancelled/etc)
  // to the public; gate to the creator/admin, matching the event-detail gating.
  // (Fuller per-event roster privacy for published events is a separate product
  // decision — tracked as a follow-up.)
  if (existing.status !== 'published' && existing.status !== 'active') {
    const viewer = getOptionalUser(event);
    const canView = !!viewer && (viewer.role === 'admin' || viewer.id === existing.createdById);
    if (!canView) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  const query = getQuery(event);
  // Same helper as listEventAttendees, for the same reason as /api/events.
  const { limit, offset } = normalizePagination({
    limit: query.limit !== undefined ? Number(query.limit) : undefined,
    offset: query.offset !== undefined ? Number(query.offset) : undefined,
  });
  const result = await listEventAttendees(db, existing.id, {
    status: (query.status as AttendeeStatus) || undefined,
    limit,
    offset,
  });
  // The event page renders `+{{ attendees.total - 8 }}`, so an untranslated
  // sentinel is an arithmetic error waiting on the guard above it.
  return { ...result, ...toPageMeta({ total: result.total, returned: result.items.length, limit, offset }) };
});
