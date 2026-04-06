import { getContentBySlug } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const db = useDB();
  // Param is named 'id' (directory name) but the value is a slug for GET requests
  const { id: slugOrId } = parseParams(event, { id: 'string' });
  const user = getOptionalUser(event);
  // Optional author query param for disambiguating user-scoped slugs
  const query = getQuery(event);
  const authorUsername = typeof query.author === 'string' ? query.author : undefined;

  const content = await getContentBySlug(db, slugOrId, user?.id, authorUsername);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }
  return content;
});
