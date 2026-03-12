import { createDocsVersion } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const body = await readBody(event);

  return createDocsVersion(db, siteSlug, user.id, body);
});
