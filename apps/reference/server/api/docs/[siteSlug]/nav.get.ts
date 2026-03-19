import { getDocsNav } from '@commonpub/server';
import { z } from 'zod';

const navQuerySchema = z.object({
  version: z.string().max(32).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = navQuerySchema.parse(getQuery(event));

  return getDocsNav(db, siteSlug, query.version);
});
