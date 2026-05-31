import { getContestBySlug, listContestStakeholders } from '@commonpub/server';

/**
 * GET /api/contests/:slug/stakeholders
 * List view-only stakeholders (contest owner or admin only).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!ownerOrPermission(event, contest.createdById, 'contest.manage')) {
    throw createError({ statusCode: 403, statusMessage: 'Only the contest owner or admin can view stakeholders' });
  }

  return listContestStakeholders(db, contest.id);
});
