import { getPollOptions, getUserPollVote } from '@commonpub/server';

/**
 * GET /api/hubs/:slug/posts/:postId/poll-options
 * Get poll options and the user's vote (if authenticated).
 */
export default defineEventHandler(async (event) => {
  requireFeature('hubs');
  const db = useDB();
  const postId = getRouterParam(event, 'postId');
  if (!postId) throw createError({ statusCode: 400, statusMessage: 'Missing postId' });

  const options = await getPollOptions(db, postId);
  const user = getOptionalUser(event);
  const userVote = user ? await getUserPollVote(db, postId, user.id) : null;

  return { options, userVote };
});
