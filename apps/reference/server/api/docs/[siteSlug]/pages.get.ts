import { getDocsSiteBySlug, listDocsPages } from '@commonpub/server';
import { z } from 'zod';

const pagesQuerySchema = z.object({
  version: z.string().max(32).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const siteSlug = getRouterParam(event, 'siteSlug')!;
  const query = pagesQuerySchema.parse(getQuery(event));

  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });
  }

  // Find the requested version or fall back to the default version
  const requestedVersion = query.version;
  let version = requestedVersion
    ? result.versions.find((v) => v.version === requestedVersion)
    : result.versions.find((v) => v.isDefault === true);

  // Fall back to first version if no default found
  if (!version && result.versions.length > 0) {
    version = result.versions[0];
  }

  if (!version) {
    throw createError({ statusCode: 404, statusMessage: 'No version found for docs site' });
  }

  return listDocsPages(db, version.id);
});
