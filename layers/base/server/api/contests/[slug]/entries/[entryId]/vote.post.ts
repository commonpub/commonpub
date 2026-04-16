import { voteOnContestEntry } from '@commonpub/server';

/**
 * POST /api/contests/:slug/entries/:entryId/vote
 * Vote on a contest entry (community voting).
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const entryId = getRouterParam(event, 'entryId');
  if (!entryId) throw createError({ statusCode: 400, statusMessage: 'Missing entryId' });

  const result = await voteOnContestEntry(db, entryId, user.id);
  if (!result.voted) {
    throw createError({ statusCode: 400, statusMessage: result.error ?? 'Vote failed' });
  }

  return { voted: true };
});
