import { getContestBySlug, removeContestJudge } from '@commonpub/server';

/**
 * DELETE /api/contests/:slug/judges/:userId
 * Remove a judge from a contest (contest owner or admin only).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  const targetUserId = getRouterParam(event, 'userId');
  if (!slug || !targetUserId) throw createError({ statusCode: 400, statusMessage: 'Missing parameters' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  if (contest.createdById !== user.id && user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only contest owner or admin can manage judges' });
  }

  const removed = await removeContestJudge(db, contest.id, targetUserId);
  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Judge not found' });

  return { removed: true };
});
