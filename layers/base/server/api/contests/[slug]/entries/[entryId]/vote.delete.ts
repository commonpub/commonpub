import { removeContestEntryVote } from '@commonpub/server';

/**
 * DELETE /api/contests/:slug/entries/:entryId/vote
 * Remove community vote from a contest entry.
 */
export default defineEventHandler(async (event) => {
  requireFeature('contests');
  const user = requireAuth(event);
  const db = useDB();
  const { entryId } = parseParams(event, { entryId: 'uuid' });

  const removed = await removeContestEntryVote(db, entryId, user.id);
  if (!removed) {
    throw createError({ statusCode: 400, statusMessage: 'No vote found' });
  }

  return { removed: true };
});
