import { getContestBySlug, transitionContestStatus, isContestEditor } from '@commonpub/server';
import type { ContestStatus } from '@commonpub/server';
import { contestTransitionSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ transitioned: boolean; newStatus: ContestStatus }> => {
  requireFeature('contests');
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, contestTransitionSchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const canManage =
    ownerOrPermission(event, contest.createdById, 'contest.manage') ||
    (await isContestEditor(db, contest.id, user.id));

  const result = await transitionContestStatus(db, contest.id, user.id, input.status, canManage);

  if (!result.transitioned) {
    const denied = /authoriz|owner/i.test(result.error ?? '');
    throw createError({ statusCode: denied ? 403 : 400, statusMessage: result.error || 'Transition failed' });
  }

  return { transitioned: true, newStatus: input.status };
});
