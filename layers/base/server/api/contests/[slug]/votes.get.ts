import { getContestBySlug, getContestEntryVotes } from '@commonpub/server';
import type { ContestEntryVoteInfo } from '@commonpub/server';

/**
 * GET /api/contests/:slug/votes
 * Batch-fetch vote counts + current user's vote status for all entries.
 */
export default defineEventHandler(async (event): Promise<ContestEntryVoteInfo[]> => {
  requireFeature('contests');
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const user = getOptionalUser(event);

  const contest = await getContestBySlug(db, slug);
  if (!contest || contest.status === 'upcoming') throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!contest.communityVotingEnabled) return [];

  return getContestEntryVotes(db, contest.id, user?.id ?? null);
});
