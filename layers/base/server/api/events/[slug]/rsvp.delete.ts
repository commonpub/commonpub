import { getEventBySlug, cancelRsvp, canReadHubById } from '@commonpub/server';

/**
 * DELETE /api/events/:slug/rsvp
 * Cancel RSVP for an event (authenticated).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const existing = await getEventBySlug(db, slug);
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Event not found' });

  // Mirror the RSVP write gate: a private-hub event is members-only (P-1b).
  if (existing.hubId) {
    const canRead = await canReadHubById(db, existing.hubId, user.id, {
      asPlatformAdmin: hasPermission(event, 'admin.access'),
    });
    if (!canRead) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  const result = await cancelRsvp(db, existing.id, user.id);
  if (!result.cancelled) {
    throw createError({ statusCode: 400, statusMessage: 'No RSVP found' });
  }

  return { cancelled: true, promoted: !!result.promoted };
});
