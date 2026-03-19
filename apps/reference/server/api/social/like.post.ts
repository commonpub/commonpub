import { toggleLike } from '@commonpub/server';
import { likeTargetTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const toggleLikeSchema = z.object({
  targetType: likeTargetTypeSchema,
  targetId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ liked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = toggleLikeSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return toggleLike(db, user.id, parsed.data.targetType, parsed.data.targetId);
});
