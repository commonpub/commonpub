import { updateDocsPage } from '@commonpub/server';
import { updateDocsPageSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const { pageId } = parseParams(event, { pageId: 'uuid' });
  const input = await parseBody(event, updateDocsPageSchema);

  const page = await updateDocsPage(db, pageId, user.id, input);
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found or not owned by you' });
  }
  return page;
});
