import { searchDocsPages } from '@commonpub/server';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = searchQuerySchema.parse(getQuery(event));

  return searchDocsPages(db, siteSlug, query.q ?? '');
});
