import { getContestBySlug, unregisterForContest, getRegistrationCounts } from '@commonpub/server';

/**
 * DELETE /api/contests/:slug/register
 * Cancel the current user's registration for a contest. Idempotent: removing a
 * non-existent registration still returns `registered: false`. Deliberately does
 * NOT gate on `canViewContest` so a participant can always leave a contest that
 * later went private. Returns the viewer's (now-false) registration state and the
 * up-to-date registrant count. Requires auth; feature-gated behind `contests`.
 */
export default defineEventHandler(async (event): Promise<{ registered: boolean; count: number; followerCount: number }> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  await unregisterForContest(db, contest.id, user.id);

  const counts = await getRegistrationCounts(db, contest.id);
  return { registered: false, count: counts.full, followerCount: counts.followers };
});
