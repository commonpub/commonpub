import { getDocsSiteBySlug, createDocsPage } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const body = await readBody(event);

  // If body doesn't include versionId, resolve it from the site's default version
  if (!body.versionId) {
    const result = await getDocsSiteBySlug(db, siteSlug);
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
    }

    const defaultVersion = result.versions.find((v) => v.isDefault === 1) ?? result.versions[0];
    if (!defaultVersion) {
      throw createError({ statusCode: 404, statusMessage: 'No version found for docs site' });
    }

    body.versionId = defaultVersion.id;
  }

  return createDocsPage(db, user.id, body);
});
