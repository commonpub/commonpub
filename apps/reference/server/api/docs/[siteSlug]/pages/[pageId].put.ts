import { updateDocsPage } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const pageId = getRouterParam(event, 'pageId')!;
  const body = await readBody(event);

  return updateDocsPage(db, pageId, user.id, body);
});
