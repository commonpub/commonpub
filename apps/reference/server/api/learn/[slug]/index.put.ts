import { getPathBySlug, updatePath } from '@commonpub/server';
import type { LearningPathDetail } from '@commonpub/server';
import { updateLearningPathSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<LearningPathDetail | null> => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const body = await readBody(event);

  const parsed = updateLearningPathSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Path not found' });

  return updatePath(db, path.id, user.id, parsed.data);
});
