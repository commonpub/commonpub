import { getDocsSiteBySlug, toPublicDocSite, isPublicDocSite, type PublicDocSiteRow } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:docs');
  requireFeature('docs');
  const slug = getRouterParam(event, 'slug');
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' });
  const db = useDB();
  const config = useConfig();
  const row = await getDocsSiteBySlug(db, slug);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
  const casted = row as unknown as PublicDocSiteRow;
  if (!isPublicDocSite(casted)) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
  return toPublicDocSite(casted, config.instance.domain);
});
