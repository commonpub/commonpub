import { createComment } from '@commonpub/server';
import type { CommentItem } from '@commonpub/server';
import { createCommentSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<CommentItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  return createComment(db, user.id, parsed.data);
});
