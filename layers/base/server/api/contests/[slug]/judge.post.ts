import { judgeContestEntry } from '@commonpub/server';
import { judgeEntrySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, judgeEntrySchema);

  const result = await judgeContestEntry(db, input.entryId, input.score, user.id, input.feedback);
  if (!result.judged) {
    throw createError({ statusCode: 403, statusMessage: result.error ?? 'Judging failed' });
  }

  return { success: true };
});
