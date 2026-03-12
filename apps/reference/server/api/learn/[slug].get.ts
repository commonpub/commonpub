import { getPathBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const user = getOptionalUser(event);

  const path = await getPathBySlug(db, slug, user?.id);
  if (!path) {
    throw createError({ statusCode: 404, statusMessage: 'Learning path not found' });
  }
  return path;
});
