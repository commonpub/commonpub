import { judgeContestEntry } from '@commonpub/server';
import { judgeEntrySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const body = await readBody(event);

  const parsed = judgeEntrySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  await judgeContestEntry(db, parsed.data.entryId, parsed.data.score, user.id);
  return { success: true };
});
