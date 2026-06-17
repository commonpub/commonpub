import { getContestBySlug, advanceContestStage, isContestEditor } from '@commonpub/server';
import { contestAdvanceSchema } from '@commonpub/schema';

// Phase B2 — apply an advancement cut at a review stage (cull the cohort to top-N
// or a manual pick, snapshot scores, advance to the next stage). Authorized for
// the owner, a per-contest `editor`, or a `contest.manage` holder.
export default defineEventHandler(async (event): Promise<{ advanced: boolean; advancedCount: number; eliminatedCount: number }> => {
  requireFeature('contests');
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, contestAdvanceSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') ||
    (await isContestEditor(db, contest.id, user.id));

  const result = await advanceContestStage(db, contest.id, user.id, input, canManage);
  if (!result.advanced) {
    const denied = /authoriz|owner/i.test(result.error ?? '');
    throw createError({ statusCode: denied ? 403 : 400, statusMessage: result.error || 'Advancement failed' });
  }
  return result;
});
