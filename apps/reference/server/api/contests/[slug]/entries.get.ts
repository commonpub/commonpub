import { listContestEntries, getContestBySlug } from '@commonpub/server';
import type { ContestEntryItem } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContestEntryItem[]> => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug required' });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, statusMessage: 'Contest not found' });
  return listContestEntries(db, contest.id);
});
