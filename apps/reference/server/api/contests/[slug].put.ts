import { updateContest } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, message: 'Slug required' });
  const body = await readBody(event);
  return updateContest(db, slug, body);
});
