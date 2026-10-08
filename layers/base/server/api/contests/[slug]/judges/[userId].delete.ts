import { getContestBySlug, removeContestJudge } from '@commonpub/server';

/**
 * DELETE /api/contests/:slug/judges/:userId
 * Remove a judge from a contest (contest owner or admin only).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  // userId validated as a uuid (the DOMAIN, not just "a string"): a non-uuid
  // used to reach Postgres as a uuid bind and come back as a 500.
  const { slug, userId: targetUserId } = parseParams(event, { slug: 'string', userId: 'uuid' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  if (!ownerOrPermission(event, contest.createdById, 'contest.manage')) {
    throw createError({ statusCode: 403, statusMessage: 'Only contest owner or admin can manage judges' });
  }

  const removed = await removeContestJudge(db, contest.id, targetUserId);
  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Judge not found' });

  return { removed: true };
});
