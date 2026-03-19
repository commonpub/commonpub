import { getDocsSiteBySlug, listDocsPages } from '@commonpub/server';
import { z } from 'zod';

const navQuerySchema = z.object({
  version: z.string().max(32).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = navQuerySchema.parse(getQuery(event));

  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });

  // Find the requested or default version
  const version = query.version
    ? result.versions?.find((v) => v.version === query.version)
    : result.versions?.find((v) => v.isDefault) ?? result.versions?.[0];

  if (!version) return [];

  // Return pages directly as nav items
  const pages = await listDocsPages(db, version.id);
  return pages.map(p => ({ id: p.id, title: p.title, slug: p.slug, sortOrder: p.sortOrder, parentId: p.parentId }));
});
