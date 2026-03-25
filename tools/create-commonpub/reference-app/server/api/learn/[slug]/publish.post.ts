import { getPathBySlug, publishPath } from '@commonpub/server';
import type { LearningPathDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<LearningPathDetail | null> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const path = await getPathBySlug(db, slug, user.id);
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Path not found' });

  return publishPath(db, path.id, user.id);
});
