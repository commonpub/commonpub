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

  const pages = await listDocsPages(db, version.id);

  // Parse content: if stored as JSON string (BlockTuple[]), parse back to array
  return pages.map((page) => {
    let content: string | unknown[] = page.content ?? '';
    if (typeof content === 'string' && content.startsWith('[')) {
      try {
        content = JSON.parse(content);
      } catch {
        // Not valid JSON — keep as markdown string
      }
    }
    return { ...page, content };
  });
});
