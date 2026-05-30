import { getContestBySlug, canViewContest } from '@commonpub/server';
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
  return contest;
});
