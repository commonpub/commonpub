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

  // Handle dual-format content: BlockTuple[] (new) or markdown string (legacy)
  // Content is stored as TEXT — JSON arrays come back as strings, need parsing
  let content: string | unknown[] = page.content ?? '';
  if (typeof content === 'string' && content.trimStart().startsWith('[')) {
    try {
      content = JSON.parse(content);
    } catch {
      // Not valid JSON — keep as markdown string
    }
  }

  if (Array.isArray(content)) {
    // New BlockTuple format — extract text for TOC generation
    const headings = extractHeadingsFromBlocks(content as [string, Record<string, unknown>][]);
    return {
      ...page,
      content,
      html: null, // Client renders blocks directly
      toc: headings,
      frontmatter: {},
      format: 'blocks',
    };
  }

  // Legacy markdown format
  const rendered = await renderMarkdown((content as string) ?? '');
  return {
    ...page,
    html: rendered.html,
    toc: rendered.toc,
    frontmatter: rendered.frontmatter,
    format: 'markdown',
  };
});

/** Extract TOC headings from BlockTuple array */
function extractHeadingsFromBlocks(
  blocks: [string, Record<string, unknown>][],
): Array<{ id: string; text: string; level: number }> {
  const headings: Array<{ id: string; text: string; level: number }> = [];
  for (const [type, content] of blocks) {
    if (type === 'heading' && content.text) {
      const text = String(content.text);
      const level = (content.level as number) || 2;
      // Must match BlockHeadingView.vue slugification exactly
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      headings.push({ id, text, level });
    }
  }
  return headings;
}
