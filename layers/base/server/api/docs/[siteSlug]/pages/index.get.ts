import { getDocsSiteBySlug, listDocsPages } from '@commonpub/server';
import { z } from 'zod';

const pagesQuerySchema = z.object({
  version: z.string().max(32).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { siteSlug } = parseParams(event, { siteSlug: 'string' });
  const query = parseQueryParams(event, pagesQuerySchema);

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

  // Public viewers only see published pages; the site owner/admin (e.g. the docs
  // editor at /docs/[siteSlug]/edit, which hits this same route) sees drafts too.
  const viewer = getOptionalUser(event);
  const canSeeDrafts = !!viewer && (viewer.role === 'admin' || viewer.id === result.site.ownerId);

  const pages = await listDocsPages(db, version.id, { publishedOnly: !canSeeDrafts });

  // Content is JSONB — arrays come back parsed, legacy strings stay as strings
  return pages.map((page) => {
    const content = page.content ?? '';
    return { ...page, content };
  });
});
