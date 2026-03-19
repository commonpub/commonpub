import { enroll, getPathBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;

  const path = await getPathBySlug(db, slug, user.id);
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Path not found' });

  return enroll(db, user.id, path.id);
});
