import { createComment, onContentCommented } from '@commonpub/server';
import type { CommentItem } from '@commonpub/server';
import { createCommentSchema } from '@commonpub/schema';

/** Content types that should federate comments */
const FEDERABLE_COMMENT_TYPES = new Set(['project', 'article', 'blog', 'explainer']);

export default defineEventHandler(async (event): Promise<CommentItem> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, createCommentSchema);

  const comment = await createComment(db, user.id, input);

  // Federate comment on content items (non-blocking)
  if (FEDERABLE_COMMENT_TYPES.has(input.targetType)) {
    onContentCommented(db, comment.id, user.id, input.targetType, input.targetId, config).catch(() => {});
  }

  return comment;
});
