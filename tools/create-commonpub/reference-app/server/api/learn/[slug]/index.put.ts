import { getPathBySlug, updatePath } from '@commonpub/server';
import type { LearningPathDetail } from '@commonpub/server';
import { updateLearningPathSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<LearningPathDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, updateLearningPathSchema);

  const path = await getPathBySlug(db, slug, user.id);
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Path not found' });

  const updated = await updatePath(db, path.id, user.id, input);
  if (!updated) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to update this path' });
  }
  return updated;
});
