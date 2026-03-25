import { getContentBySlug } from '@commonpub/server';
import type { ContentDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<ContentDetail> => {
  const db = useDB();
  // Param is named 'id' (directory name) but the value is a slug for GET requests
  const { id: slugOrId } = parseParams(event, { id: 'string' });
  const user = getOptionalUser(event);

  const content = await getContentBySlug(db, slugOrId, user?.id);
  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }
  return content;
});
