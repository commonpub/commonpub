import { voteOnPoll } from '@commonpub/server';
import { z } from 'zod';

const pollVoteSchema = z.object({
  optionId: z.string().uuid(),
});

/**
 * POST /api/hubs/:slug/posts/:postId/poll-vote
 * Vote on a poll option.
 */
export default defineEventHandler(async (event) => {
  requireFeature('hubs');
  const user = requireAuth(event);
  const db = useDB();
  const postId = getRouterParam(event, 'postId');
  if (!postId) throw createError({ statusCode: 400, statusMessage: 'Missing postId' });

  const body = await parseBody(event, pollVoteSchema);
  const result = await voteOnPoll(db, postId, body.optionId, user.id);

  if (!result.voted) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Vote failed' });
  }

  return { voted: true };
});
