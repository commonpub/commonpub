import { getContestBySlug, addContestStakeholder } from '@commonpub/server';
import { stakeholderRoleSchema } from '@commonpub/schema';
import { z } from 'zod';

const addStakeholderSchema = z.object({
  userId: z.string().uuid(),
  // 'reviewer' (view-only, default) or 'editor' (full edit rights to THIS
  // contest only). Only owner / contest.manage can add or promote, so an editor
  // cannot mint more editors.
  role: stakeholderRoleSchema.optional(),
});

/**
 * POST /api/contests/:slug/stakeholders
 * Grant a user per-contest access (reviewer = view-only, editor = full edit of
 * this contest). Contest owner or a `contest.manage` holder only.
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
    role: body.role,
    contestSlug: slug,
    contestTitle: contest.title,
    invitedBy: user.id,
  });
  if (!result.added) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to add stakeholder' });
  }
  return { added: true, updated: result.updated ?? false };
});
