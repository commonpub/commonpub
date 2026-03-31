import { getPathBySlug, unenroll } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<boolean> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const path = await getPathBySlug(db, slug, user.id);
  if (!path) throw createError({ statusCode: 404, statusMessage: 'Path not found' });

  return unenroll(db, user.id, path.id);
});
