import { getContestBySlug, removeContestStakeholder } from '@commonpub/server';

/**
 * DELETE /api/contests/:slug/stakeholders/:userId
 * Revoke a stakeholder's review access (contest owner or admin only).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  // userId validated as a uuid (the DOMAIN, not just "a string"): a non-uuid
  // used to reach Postgres as a uuid bind and come back as a 500.
  const { slug, userId } = parseParams(event, { slug: 'string', userId: 'uuid' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  if (!ownerOrPermission(event, contest.createdById, 'contest.manage')) {
    throw createError({ statusCode: 403, statusMessage: 'Only the contest owner or admin can manage stakeholders' });
  }

  const removed = await removeContestStakeholder(db, contest.id, userId);
  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Stakeholder not found' });
  return { removed: true };
});
