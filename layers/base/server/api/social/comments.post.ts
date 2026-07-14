import { createComment, canAccessCommentTarget, onContentCommented } from '@commonpub/server';
import type { CommentItem } from '@commonpub/server';
import { createCommentSchema } from '@commonpub/schema';

/** Content types that should federate comments */
const FEDERABLE_COMMENT_TYPES = new Set(['project', 'article', 'blog', 'explainer']);

export default defineEventHandler(async (event): Promise<CommentItem> => {
  requireFeature('social');
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, createCommentSchema);

  // Gate the write on parent read-access. 404 (not 403) so we don't disclose the
  // existence of a private-hub post or members-only item to a non-viewer. The
  // server createComment re-checks as a backstop for any other caller.
  if (!(await canAccessCommentTarget(db, input.targetType, input.targetId, user.id))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const comment = await createComment(db, user.id, input);

  // Federate comment on content items (non-blocking)
  if (FEDERABLE_COMMENT_TYPES.has(input.targetType)) {
    onContentCommented(db, comment.id, user.id, input.targetType, input.targetId, config).catch(() => {});
  }

  return comment;
});
