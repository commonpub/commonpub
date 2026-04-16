import { getEventBySlug } from '@commonpub/server';

/**
 * GET /api/events/:slug
 * Get event details by slug (public).
 */
export default defineEventHandler(async (event) => {
  requireFeature('events');
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const result = await getEventBySlug(db, slug);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Event not found' });

  return result;
});
