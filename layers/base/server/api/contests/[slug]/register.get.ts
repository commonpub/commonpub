import {
  getContestBySlug,
  canViewContest,
  getViewerRegistration,
  getRegistrantCount,
} from '@commonpub/server';

/**
 * GET /api/contests/:slug/register
 * The current viewer's registration state for a contest — whether registered, at
 * which tier, and their saved info (to prefill the optional form) — plus the
 * public participant count. Drives the initial state of the signup card. Anonymous
 * callers get `registered: false` (the count is public). 404s an unknown slug and,
 * for a non-public contest, one the viewer can't see (so we never leak that it
 * exists). Feature-gated behind `contests`.
 */
export default defineEventHandler(async (event): Promise<{ registered: boolean; tier: 'full' | 'reminders' | null; fields: Record<string, string> | null; count: number }> => {
  requireFeature('contests');
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  const user = getOptionalUser(event);
  if (!(await canViewContest(db, contest, user))) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const [reg, count] = await Promise.all([
    user ? getViewerRegistration(db, contest.id, user.id) : Promise.resolve(null),
    getRegistrantCount(db, contest.id),
  ]);

  return { registered: !!reg, tier: reg?.tier ?? null, fields: reg?.fields ?? null, count };
});
