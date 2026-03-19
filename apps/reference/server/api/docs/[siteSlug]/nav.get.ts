import { getDocsSiteBySlug, listDocsPages } from '@commonpub/server';
import { z } from 'zod';

const navQuerySchema = z.object({
  version: z.string().max(32).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = navQuerySchema.parse(getQuery(event));

  const site = await getDocsSiteBySlug(db, siteSlug);
  if (!site) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });

  // Find the requested or default version
  const version = query.version
    ? site.versions?.find((v: { version: string }) => v.version === query.version)
    : site.versions?.find((v: { isDefault: boolean }) => v.isDefault) ?? site.versions?.[0];

  if (!version) return [];

  // Return pages directly as nav items (docsNav table structure field is never populated)
  const pages = await listDocsPages(db, version.id);
  return pages.map(p => ({ id: p.id, title: p.title, slug: p.slug, sortOrder: p.sortOrder }));
});
