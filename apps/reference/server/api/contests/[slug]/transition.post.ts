import { getContestBySlug, transitionContestStatus } from '@commonpub/server';
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

  const result = await transitionContestStatus(db, contest.id, user.id, input.status);

  if (!result.transitioned) {
    throw createError({ statusCode: 400, statusMessage: result.error || 'Transition failed' });
  }

  return { transitioned: true, newStatus: input.status };
});
