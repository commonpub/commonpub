import { getContestBySlug, acceptJudgeInvite } from '@commonpub/server';

/**
 * POST /api/contests/:slug/judges/accept
 * Accept a judge invitation (authenticated user).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  const accepted = await acceptJudgeInvite(db, contest.id, user.id);
  if (!accepted) throw createError({ statusCode: 400, statusMessage: 'No pending invitation found' });

  return { accepted: true };
});
