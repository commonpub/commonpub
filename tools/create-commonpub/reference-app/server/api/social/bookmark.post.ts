import { toggleBookmark } from '@commonpub/server';
import { z } from 'zod';

const toggleBookmarkSchema = z.object({
  targetType: z.enum(['project', 'article', 'blog', 'explainer', 'learning_path']),
  targetId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ bookmarked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, toggleBookmarkSchema);

  return toggleBookmark(db, user.id, input.targetType, input.targetId);
});
