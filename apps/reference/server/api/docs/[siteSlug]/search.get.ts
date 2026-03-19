import { searchDocsPages, getDocsSiteBySlug } from '@commonpub/server';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = searchQuerySchema.parse(getQuery(event));

  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });

  const version = site.versions?.find((v: { isDefault: boolean }) => v.isDefault) ?? site.versions?.[0];
  if (!version) return [];

  return searchDocsPages(db, site.id, version.id, query.q ?? '');
});
