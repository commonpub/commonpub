import { getDocsSiteBySlug, createDocsPage } from '@commonpub/server';
import { createDocsPageSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const user = requireAuth(event);
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const body = await readBody(event);

  const parsed = createDocsPageSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors: parsed.error.flatten().fieldErrors },
    });
  }

  const data = { ...parsed.data };

  // If no versionId provided, resolve from the site's default version
  if (!data.versionId) {
    const result = await getDocsSiteBySlug(db, siteSlug);
    if (!result) {
      throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
    }

    const defaultVersion = result.versions.find((v) => v.isDefault === true) ?? result.versions[0];
    if (!defaultVersion) {
      throw createError({ statusCode: 404, statusMessage: 'No version found for docs site' });
    }

    data.versionId = defaultVersion.id;
  }

  return createDocsPage(db, user.id, data);
});
