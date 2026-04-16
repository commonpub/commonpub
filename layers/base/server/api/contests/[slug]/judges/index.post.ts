import { getContestBySlug, addContestJudge } from '@commonpub/server';
import type { JudgeRole } from '@commonpub/server';
import { z } from 'zod';

const addJudgeSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['lead', 'judge', 'guest']).optional(),
});

/**
 * POST /api/contests/:slug/judges
 * Add a judge to a contest (contest owner or admin only).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  if (contest.createdById !== user.id && user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only contest owner or admin can manage judges' });
  }

  const body = await parseBody(event, addJudgeSchema);
  const result = await addContestJudge(db, contest.id, body.userId, (body.role ?? 'judge') as JudgeRole);

  if (!result.added) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Failed to add judge' });
  }

  return { added: true };
});
