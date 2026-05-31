import { getContestBySlug, removeContestStakeholder } from '@commonpub/server';

/**
 * DELETE /api/contests/:slug/stakeholders/:userId
 * Revoke a stakeholder's review access (contest owner or admin only).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  const userId = getRouterParam(event, 'userId');
  if (!slug || !userId) throw createError({ statusCode: 400, statusMessage: 'Missing slug or userId' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!ownerOrPermission(event, contest.createdById, 'contest.manage')) {
    throw createError({ statusCode: 403, statusMessage: 'Only the contest owner or admin can manage stakeholders' });
  }

  const removed = await removeContestStakeholder(db, contest.id, userId);
  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Stakeholder not found' });
  return { removed: true };
});
