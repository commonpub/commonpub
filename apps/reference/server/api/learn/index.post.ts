import { createPath } from '@commonpub/server';
import type { LearningPathDetail } from '@commonpub/server';
import { createLearningPathSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<LearningPathDetail> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = createLearningPathSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createPath(db, user.id, parsed.data);
});
