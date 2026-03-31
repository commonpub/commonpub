import { getDocsSiteBySlug } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: 'string' });

  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
  }

  // Flatten the nested { site, versions } shape so frontend can use site.name directly
  return {
    ...result.site,
    versions: result.versions,
  };
});
