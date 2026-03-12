import { getDocsSiteBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;

  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) {
    throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
  }
  return site;
});
