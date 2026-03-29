import { isBookmarked } from '@commonpub/server';
import { z } from 'zod';

const checkSchema = z.object({
  targetType: z.enum(['project', 'article', 'blog', 'explainer', 'learning_path']),
  targetId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ bookmarked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const query = parseQueryParams(event, checkSchema);

  const bookmarked = await isBookmarked(db, user.id, query.targetType, query.targetId);
  return { bookmarked };
});
