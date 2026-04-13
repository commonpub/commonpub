import { withdrawContestEntry } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ withdrawn: boolean }> => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const entryId = getRouterParam(event, 'entryId')!;

  const result = await withdrawContestEntry(db, entryId, user.id);
  if (!result.withdrawn) {
    throw createError({ statusCode: 400, message: result.error ?? 'Cannot withdraw entry' });
  }
  return { withdrawn: true };
});
