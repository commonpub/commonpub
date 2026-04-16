import { getEventBySlug, cancelRsvp } from '@commonpub/server';

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

  const cancelled = await cancelRsvp(db, existing.id, user.id);
  if (!cancelled) {
    throw createError({ statusCode: 400, statusMessage: 'No RSVP found' });
  }

  return { cancelled: true };
});
