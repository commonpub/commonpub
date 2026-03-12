import { getPathBySlug, updatePath } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const body = await readBody(event);

  const path = await getPathBySlug(db, slug);
  if (!path) throw createError({ statusCode: 404, message: 'Path not found' });

  return updatePath(db, path.id, user.id, body);
});
