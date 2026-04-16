import { voteOnPost } from '@commonpub/server';
import { z } from 'zod';

const voteSchema = z.object({
  direction: z.enum(['up', 'down']),
});

/**
 * POST /api/hubs/:slug/posts/:postId/vote
 * Upvote or downvote a hub post. Toggles off if same direction, flips if different.
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const postId = getRouterParam(event, 'postId');
  if (!postId) throw createError({ statusCode: 400, statusMessage: 'Missing postId' });

  const body = await parseBody(event, voteSchema);
  return voteOnPost(db, postId, user.id, body.direction);
});
