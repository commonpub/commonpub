import { searchDocsPages, getDocsSiteBySlug } from '@commonpub/server';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().max(200).optional(),
});

export default defineEventHandler(async (event) => {
  const db = useDB();
  const config = useConfig();
  const { siteSlug } = parseParams(event, { siteSlug: 'string' });
  const query = parseQueryParams(event, searchQuerySchema);

  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });

  const version = result.versions?.find((v) => v.isDefault) ?? result.versions?.[0];
  if (!version) return [];

  // Public viewers only search published pages; the site owner/admin sees drafts too.
  const viewer = getOptionalUser(event);
  const canSeeDrafts = !!viewer && (viewer.role === 'admin' || viewer.id === result.site.ownerId);

  return searchDocsPages(db, result.site.id, version.id, query.q ?? '', config.docs.searchLanguage, {
    publishedOnly: !canSeeDrafts,
  });
});
