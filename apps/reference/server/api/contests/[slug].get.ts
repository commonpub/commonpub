import { getContestBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, message: 'Slug required' });
  const contest = await getContestBySlug(db, slug);
  if (!contest) throw createError({ statusCode: 404, message: 'Contest not found' });
  return contest;
});
