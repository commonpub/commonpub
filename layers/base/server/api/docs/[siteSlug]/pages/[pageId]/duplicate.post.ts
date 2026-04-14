import { duplicateDocsPage } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { pageId } = parseParams(event, { pageId: 'uuid' });

  try {
    return await duplicateDocsPage(db, pageId, user.id);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Not authorized') {
      throw createError({ statusCode: 404, statusMessage: 'Page not found or not owned by you' });
    }
    throw err;
  }
});
