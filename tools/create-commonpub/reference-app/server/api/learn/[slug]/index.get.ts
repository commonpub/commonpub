import { getPathBySlug } from '@commonpub/server';
import type { LearningPathDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<LearningPathDetail> => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const user = getOptionalUser(event);

  const path = await getPathBySlug(db, slug, user?.id);
  if (!path) {
    throw createError({ statusCode: 404, statusMessage: 'Learning path not found' });
  }
  return path;
});
