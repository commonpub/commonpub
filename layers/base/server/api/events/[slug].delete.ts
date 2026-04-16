import { deleteEvent, getEventBySlug } from '@commonpub/server';

/**
 * DELETE /api/events/:slug
 * Delete an event (owner or admin).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const existing = await getEventBySlug(db, slug);
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Event not found' });

  const isAdmin = user.role === 'admin';
  const deleted = await deleteEvent(db, existing.id, user.id, isAdmin);
  if (!deleted) throw createError({ statusCode: 403, statusMessage: 'Unauthorized' });

  return { deleted: true };
});
