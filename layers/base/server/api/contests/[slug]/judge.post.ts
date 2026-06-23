import { getContestBySlug, judgeContestEntry } from '@commonpub/server';
import { judgeEntrySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const input = await parseBody(event, judgeEntrySchema);

  // B5a — resolve the contest from the route `:slug` and assert the entry belongs
  // to it, so the slug in the path actually scopes the judged entry.
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });

  const result = await judgeContestEntry(db, input.entryId, input.score, user.id, input.feedback, input.criteriaScores, contest.id);
  if (!result.judged) {
    throw createError({ statusCode: 403, statusMessage: result.error ?? 'Judging failed' });
  }

  return { success: true };
});
