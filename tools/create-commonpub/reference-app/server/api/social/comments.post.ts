import { createComment } from '@commonpub/server';
import type { CommentItem } from '@commonpub/server';
import { createCommentSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<CommentItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, createCommentSchema);

  return createComment(db, user.id, input);
});
