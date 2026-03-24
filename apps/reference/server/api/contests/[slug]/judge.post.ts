import { judgeContestEntry } from '@commonpub/server';
import { judgeEntrySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const input = await parseBody(event, judgeEntrySchema);

  await judgeContestEntry(db, input.entryId, input.score, user.id);
  return { success: true };
});
