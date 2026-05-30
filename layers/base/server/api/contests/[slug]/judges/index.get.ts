import { getContestBySlug, listContestJudges, canViewContest } from '@commonpub/server';

/**
 * GET /api/contests/:slug/judges
 * List judges for a contest.
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!(await canViewContest(db, contest, getOptionalUser(event)))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  return listContestJudges(db, contest.id);
});
