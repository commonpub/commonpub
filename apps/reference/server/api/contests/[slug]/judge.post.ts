import { judgeContestEntry } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAuth(event);
  const db = useDB();
  const body = await readBody(event);
  await judgeContestEntry(db, body.entryId, body.score, body.judgeId);
  return { success: true };
});
