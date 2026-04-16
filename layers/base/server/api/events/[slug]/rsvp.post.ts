import { getEventBySlug, rsvpEvent } from '@commonpub/server';

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

  const result = await rsvpEvent(db, existing.id, user.id);
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'RSVP failed' });
  }

  return { status: result.status };
});
