import { getEventBySlug, canReadHubById } from '@commonpub/server';

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

  // A private-hub event (incl. its onlineUrl) is members-only (P-1b). 404 (not 403)
  // so the slug's existence isn't leaked.
  if (result.hubId) {
    const viewer = getOptionalUser(event);
    const canRead = await canReadHubById(db, result.hubId, viewer?.id, {
      asPlatformAdmin: hasPermission(event, 'admin.access'),
    });
    if (!canRead) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  // Only published/active events are publicly viewable. Draft/cancelled/completed
  // events are visible only to the creator or an admin (mirrors content/contest
  // draft gating). 404 (not 403) so the slug's existence isn't leaked.
  if (result.status !== 'published' && result.status !== 'active') {
    const viewer = getOptionalUser(event);
    const canView = !!viewer && (viewer.role === 'admin' || viewer.id === result.createdById);
    if (!canView) throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  return result;
});
