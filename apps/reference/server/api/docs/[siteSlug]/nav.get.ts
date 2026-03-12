import { getDocsNav } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = getQuery(event);

  return getDocsNav(db, siteSlug, query.version as string | undefined);
});
