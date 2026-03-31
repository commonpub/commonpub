import { isLiked } from '@commonpub/server';
import { likeTargetTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const likeQuerySchema = z.object({
  targetType: likeTargetTypeSchema,
  targetId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ liked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const query = parseQueryParams(event, likeQuerySchema);

  const liked = await isLiked(db, user.id, query.targetType, query.targetId);
  return { liked };
});
