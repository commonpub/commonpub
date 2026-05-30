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
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  // Voting disabled, or contest not yet open (no entries) → empty array, not an error.
  if (!contest.communityVotingEnabled || contest.status === 'upcoming') return [];

  return getContestEntryVotes(db, contest.id, user?.id ?? null);
});
