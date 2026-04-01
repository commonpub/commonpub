import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSlug from 'rehype-slug';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { RenderOptions, RenderResult } from '../types.js';
import { parseFrontmatter } from './frontmatter.js';
import { extractHeadings } from './headings.js';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow id for heading anchors (rehype-slug)
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id', 'className'],
    code: [...(defaultSchema.attributes?.['code'] ?? []), 'className', 'style'],
    span: [...(defaultSchema.attributes?.['span'] ?? []), 'className', 'style'],
    pre: [...(defaultSchema.attributes?.['pre'] ?? []), 'className', 'style'],
  },
};

/**
 * Render markdown to HTML with syntax highlighting, TOC extraction, and frontmatter parsing.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const { frontmatter, content } = parseFrontmatter(markdown);
  const toc = extractHeadings(content);

  const plugins: Array<[unknown, ...unknown[]] | unknown> = [
    remarkParse,
    remarkGfm,
    remarkFrontmatter,
    [remarkRehype, { allowDangerousHtml: false }],
    rehypeSlug,
  ];

  // Add syntax highlighting if shiki is available
  try {
    const { default: rehypeShiki } = await import('@shikijs/rehype');
    plugins.push([rehypeShiki, { theme: options.highlightTheme ?? 'github-dark' }]);
  } catch {
    // shiki not available, skip highlighting
  }

  // Sanitize HTML to prevent XSS — must come after shiki (which adds classes)
  plugins.push([rehypeSanitize, sanitizeSchema]);

  plugins.push([rehypeStringify, { allowDangerousHtml: false }]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processor = unified() as any;
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      processor = processor.use(plugin[0], ...plugin.slice(1));
    } else {
      processor = processor.use(plugin);
    }
  }

  const result = await processor.process(content);

  return {
    html: String(result),
    toc,
    frontmatter,
  };
}

