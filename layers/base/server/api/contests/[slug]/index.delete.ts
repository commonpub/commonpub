import { getContestBySlug, deleteContest } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ deleted: boolean }> => {
  requireFeature('contests');
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: 'string' });


  const contest = await getContestBySlug(db, slug);
  if (!contest) {
    throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  }

  const deleted = await deleteContest(db, contest.id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to delete this contest' });
  }

  return { deleted: true };
});
