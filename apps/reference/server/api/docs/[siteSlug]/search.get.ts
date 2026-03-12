import { searchDocsPages } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = getQuery(event);

  return searchDocsPages(db, siteSlug, query.q as string ?? '');
});
