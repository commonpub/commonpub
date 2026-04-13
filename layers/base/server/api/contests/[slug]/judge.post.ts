import { judgeContestEntry, getContestBySlug } from '@commonpub/server';
import { judgeEntrySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, judgeEntrySchema);

  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, message: 'Contest not found' });
  const judges = (contest.judges ?? []) as string[];
  if (!judges.includes(user.id)) throw createError({ statusCode: 403, message: 'Not a judge for this contest' });

  await judgeContestEntry(db, input.entryId, input.score, user.id, input.feedback);
  return { success: true };
});
