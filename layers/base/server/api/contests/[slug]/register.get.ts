import {
  getContestBySlug,
  canViewContest,
  isRegisteredForContest,
  getRegistrantCount,
} from '@commonpub/server';

/**
 * GET /api/contests/:slug/register
 * The current viewer's registration state for a contest plus the public
 * registrant count. Drives the initial state of the register button. Anonymous
 * callers get `registered: false` (the count is public). 404s an unknown slug
 * and, for a non-public contest, one the viewer can't see (so we never leak that
 * it exists). Feature-gated behind `contests`.
 */
export default defineEventHandler(async (event): Promise<{ registered: boolean; count: number }> => {
  requireFeature('contests');
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  const user = getOptionalUser(event);
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const [registered, count] = await Promise.all([
    user ? isRegisteredForContest(db, contest.id, user.id) : Promise.resolve(false),
    getRegistrantCount(db, contest.id),
  ]);

  return { registered, count };
});
