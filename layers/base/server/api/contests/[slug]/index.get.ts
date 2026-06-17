import { getContestBySlug, canViewContest, isContestEditor } from '@commonpub/server';
import type { ContestDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContestDetail> => {
  requireFeature('contests');
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  // Access control: private contests are only visible to owner/admin/stakeholders/
  // judges/allowed-roles. 404 (not 403) so we don't leak that the contest exists.
  const user = getOptionalUser(event);
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }
  // Per-request manage flag for the client (owner / editor / contest.manage).
  // Server stays the enforcement boundary; this only drives UI affordances.
  contest.viewerCanManage = user
    ? ownerOrPermission(event, contest.createdById, 'contest.manage') ||
      (await isContestEditor(db, contest.id, user.id))
    : false;
  return contest;
});
