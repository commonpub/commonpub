import { getPollOptions, getUserPollVote } from '@commonpub/server';

/**
 * GET /api/hubs/:slug/posts/:postId/poll-options
 * Get poll options and the user's vote (if authenticated).
 */
export default defineEventHandler(async (event) => {
  requireFeature('hubs');
  const db = useDB();
  const { postId } = parseParams(event, { postId: 'uuid' });

  const options = await getPollOptions(db, postId);
  const user = getOptionalUser(event);
  const userVote = user ? await getUserPollVote(db, postId, user.id) : null;

  return { options, userVote };
});
