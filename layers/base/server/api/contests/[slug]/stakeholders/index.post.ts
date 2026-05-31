import { getContestBySlug, addContestStakeholder } from '@commonpub/server';
import { z } from 'zod';

const addStakeholderSchema = z.object({ userId: z.string().uuid() });

/**
 * POST /api/contests/:slug/stakeholders
 * Grant a user view-only review access (contest owner or admin only).
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
    throw createError({ statusCode: 403, statusMessage: 'Only the contest owner or admin can manage stakeholders' });
  }

  const body = await parseBody(event, addStakeholderSchema);
  const result = await addContestStakeholder(db, contest.id, body.userId, {
    contestSlug: slug,
    contestTitle: contest.title,
    invitedBy: user.id,
  });
  if (!result.added) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to add stakeholder' });
  }
  return { added: true };
});
