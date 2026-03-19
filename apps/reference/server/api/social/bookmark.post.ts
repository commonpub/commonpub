import { toggleBookmark } from '@commonpub/server';
import { bookmarkTargetTypeEnum } from '@commonpub/schema';
import { z } from 'zod';

const toggleBookmarkSchema = z.object({
  targetType: z.enum(['project', 'article', 'blog', 'explainer', 'learning_path']),
  targetId: z.string().uuid(),
});

export default defineEventHandler(async (event): Promise<{ bookmarked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = toggleBookmarkSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return toggleBookmark(db, user.id, parsed.data.targetType, parsed.data.targetId);
});
