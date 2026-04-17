import { getPathBySlug, toPublicLearningPath, type PublicLearningPathRow } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:learn');
  requireFeature('learning');
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });
  const db = useDB();
  const config = useConfig();
  const path = await getPathBySlug(db, slug);
  if (!path || path.status !== 'published' || (path as { deletedAt?: Date | null }).deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Learning path not found' });
  }
  return toPublicLearningPath(path as unknown as PublicLearningPathRow, config.instance.domain);
});
