import type { DocsPage, DocsSite, SearchDocument } from '../types.js';
import { extractHeadings } from '../render/headings.js';

/**
 * Strip markdown syntax markers to produce plain text for search indexing.
 */
export function stripMarkdown(markdown: string): string {
  return (
    markdown
      // Remove frontmatter
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove emphasis
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove blockquote markers
      .replace(/^>\s?/gm, '')
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Collapse whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Build a search document from a docs page for indexing.
 */
export function buildSearchDocument(
  page: DocsPage,
  site: DocsSite,
  versionId: string,
  pagePath: string,
): SearchDocument {
  const headings = extractHeadings(page.content).map((h) => h.text);
  const content = stripMarkdown(page.content);

  return {
    pageId: page.id,
    siteId: site.id,
    versionId,
    title: page.title,
    path: pagePath,
    headings,
    content,
  };
}

/**
 * Build a Postgres to_tsquery-compatible search query from user input.
 * Splits on whitespace and joins with & (AND).
 */
export function buildSearchQuery(query: string): string {
  const terms = query
    .trim()
    .split(/[\s@/]+/)
    .filter(Boolean)
    .map((term) => term.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);

  if (terms.length === 0) return '';

  return terms.map((t) => `${t}:*`).join(' & ');
}
