import { toggleLike, onContentLiked, onContentUnliked, resolveContentObjectUri } from '@commonpub/server';
import { likeTargetTypeSchema } from '@commonpub/schema';
import { z } from 'zod';

const toggleLikeSchema = z.object({
  targetType: likeTargetTypeSchema,
  targetId: z.string().uuid(),
});

/** Content types that should federate likes (not posts or comments) */
const FEDERABLE_LIKE_TYPES = new Set(['project', 'article', 'blog', 'explainer']);

export default defineEventHandler(async (event): Promise<{ liked: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const config = useConfig();
  const input = await parseBody(event, toggleLikeSchema);

  const result = await toggleLike(db, user.id, input.targetType, input.targetId);

  // Federate likes on content items (not posts/comments)
  if (FEDERABLE_LIKE_TYPES.has(input.targetType)) {
    const contentUri = await resolveContentObjectUri(db, input.targetId, config.instance.domain);
    if (contentUri) {
      if (result.liked) {
        await onContentLiked(db, user.id, contentUri, config);
      } else {
        await onContentUnliked(db, user.id, contentUri, config);
      }
    }
  }

  return result;
});
