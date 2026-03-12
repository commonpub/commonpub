import { getContentBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const user = getOptionalUser(event);

  const content = await getContentBySlug(db, slug, user?.id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }
  return content;
});
