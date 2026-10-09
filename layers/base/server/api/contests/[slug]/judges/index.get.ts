import { getContestBySlug, listContestJudges, canViewContest, isContestEditor } from '@commonpub/server';

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

  const judges = await listContestJudges(db, contest.id);
  const user = getOptionalUser(event);
  const organizer =
    !!user &&
    (ownerOrPermission(event, contest.createdById, 'contest.manage') || (await isContestEditor(db, contest.id, user.id)));
  if (organizer) return judges;
  // Everyone else sees the panel as it stands: accepted judges, plus their OWN
  // row so an invitee can still find and accept their invitation. Who was asked
  // and hasn't answered is the organizer's business, not the public's.
  return judges.filter((j) => j.acceptedAt || j.userId === user?.id);
});
