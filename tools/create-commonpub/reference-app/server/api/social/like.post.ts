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
  const input = await parseBody(event, toggleLikeSchema);

  return toggleLike(db, user.id, input.targetType, input.targetId);
});
