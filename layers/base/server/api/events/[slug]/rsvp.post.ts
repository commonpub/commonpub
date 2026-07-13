import { getEventBySlug, rsvpEvent, canReadHubById } from '@commonpub/server';

/**
 * POST /api/events/:slug/rsvp
 * RSVP to an event (authenticated).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const existing = await getEventBySlug(db, slug);
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Event not found' });

  // A non-member must not RSVP to (or inflate attendeeCount on) a private-hub event
  // they can't read (P-1b). 404 so the slug's existence isn't leaked.
  if (existing.hubId) {
    const canRead = await canReadHubById(db, existing.hubId, user.id, {
      asPlatformAdmin: hasPermission(event, 'admin.access'),
    });
    if (!canRead) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  const result = await rsvpEvent(db, existing.id, user.id);
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'RSVP failed' });
  }

  return { status: result.status };
});
