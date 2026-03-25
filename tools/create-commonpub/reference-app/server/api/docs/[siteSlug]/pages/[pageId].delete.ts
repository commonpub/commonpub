import { deleteDocsPage } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { pageId } = parseParams(event, { pageId: 'uuid' });

  const result = await deleteDocsPage(db, pageId, user.id);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found or not authorized' });
  }

  return { success: true };
});
