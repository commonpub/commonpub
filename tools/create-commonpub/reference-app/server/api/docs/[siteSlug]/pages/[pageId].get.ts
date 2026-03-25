import { getDocsSiteBySlug, listDocsPages } from '@commonpub/server';
import { renderMarkdown } from '@commonpub/docs';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { siteSlug, pageId: pageSlug } = parseParams(event, { siteSlug: 'string', pageId: 'string' });
  const query = getQuery(event) as { version?: string };

  const result = await getDocsSiteBySlug(db, siteSlug);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Docs site not found' });

  const version = query.version
    ? result.versions.find((v) => v.version === query.version)
    : result.versions.find((v) => v.isDefault) ?? result.versions[0];

  if (!version) throw createError({ statusCode: 404, statusMessage: 'No version found' });

  const pages = await listDocsPages(db, version.id);
  const page = pages.find((p) => p.slug === pageSlug);
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found' });

  // Render markdown to HTML with TOC extraction
  const rendered = await renderMarkdown(page.content ?? '');

  return {
    ...page,
    html: rendered.html,
    toc: rendered.toc,
    frontmatter: rendered.frontmatter,
  };
});
