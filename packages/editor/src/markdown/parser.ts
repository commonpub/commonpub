/**
 * Markdown → BlockTuple[] converter.
 * Uses unified/remark to parse markdown into an AST, then maps each node
 * to the corresponding BlockTuple type.
 *
 * Pure and synchronous — no async, no DOM, no side effects.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import type { Root, Content, Heading, Code, Image, ThematicBreak, Blockquote, List, Table, Html, Paragraph } from 'mdast';
import type { BlockTuple } from '../blocks/types.js';

export interface MarkdownParseOptions {
  /** Handle wikilinks [[page]] or [[page|text]]. Default: strip to display text. */
  wikilinkHandler?: (page: string, displayText?: string) => string;
}

const CALLOUT_REGEX = /^\[!(NOTE|TIP|WARNING|DANGER|INFO|CAUTION|EXAMPLE|ABSTRACT|TODO|BUG|QUOTE|IMPORTANT)\]\s*/i;

const CALLOUT_VARIANT_MAP: Record<string, 'info' | 'tip' | 'warning' | 'danger'> = {
  note: 'info',
  info: 'info',
  abstract: 'info',
  todo: 'info',
  example: 'info',
  quote: 'info',
  bug: 'warning',
  caution: 'warning',
  important: 'warning',
  tip: 'tip',
  warning: 'warning',
  danger: 'danger',
};

/**
 * Convert a markdown string to an array of BlockTuples.
 */
export function markdownToBlockTuples(md: string, options?: MarkdownParseOptions): BlockTuple[] {
  if (!md || !md.trim()) return [];

  // Preprocess wikilinks before parsing
  const processed = preprocessWikilinks(md, options?.wikilinkHandler);

  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(processed) as Root;

  const blocks: BlockTuple[] = [];

  for (const node of tree.children) {
    const mapped = mapNode(node);
    if (mapped) {
      if (Array.isArray(mapped[0]) && Array.isArray(mapped[0])) {
        // Multiple blocks returned (e.g., from consecutive paragraphs)
        blocks.push(...(mapped as BlockTuple[]));
      } else {
        blocks.push(mapped as BlockTuple);
      }
    }
  }

  return blocks;
}

function mapNode(node: Content): BlockTuple | BlockTuple[] | null {
  switch (node.type) {
    case 'heading':
      return mapHeading(node as Heading);
    case 'paragraph':
      return mapParagraph(node as Paragraph);
    case 'code':
      return mapCode(node as Code);
    case 'image':
      return mapImage(node as Image);
    case 'blockquote':
      return mapBlockquote(node as Blockquote);
    case 'thematicBreak':
      return ['divider', {}] as BlockTuple;
    case 'list':
      return mapList(node as List);
    case 'table':
      return mapTable(node as Table);
    case 'html':
      return mapHtml(node as Html);
    default:
      return null;
  }
}

function mapHeading(node: Heading): BlockTuple {
  const level = Math.min(node.depth, 4) as 1 | 2 | 3 | 4;
  const text = extractPlainText(node);
  return ['heading', { text, level }];
}

function mapParagraph(node: Paragraph): BlockTuple | null {
  // Check if paragraph contains only an image
  if (node.children.length === 1 && node.children[0]!.type === 'image') {
    return mapImage(node.children[0] as Image);
  }

  const html = inlineToHtml(node);
  if (!html.trim()) return null;
  return ['text', { html: `<p>${html}</p>` }];
}

function mapCode(node: Code): BlockTuple {
  let language = node.lang || '';
  let filename: string | undefined;

  // Parse lang:filename format (e.g., "ts:utils.ts")
  if (language.includes(':')) {
    const parts = language.split(':');
    language = parts[0]!;
    filename = parts.slice(1).join(':');
  }

  return ['code', { code: node.value, language, ...(filename ? { filename } : {}) }];
}

function mapImage(node: Image): BlockTuple {
  return ['image', { src: node.url, alt: node.alt || '', caption: node.title || '' }];
}

function mapBlockquote(node: Blockquote): BlockTuple {
  // Check for Obsidian callout syntax
  const firstChild = node.children[0];
  if (firstChild?.type === 'paragraph') {
    const firstText = firstChild.children[0];
    if (firstText?.type === 'text') {
      const match = firstText.value.match(CALLOUT_REGEX);
      if (match) {
        const calloutType = match[1]!.toLowerCase();
        const variant = CALLOUT_VARIANT_MAP[calloutType] || 'info';

        // Remove the callout marker from the text
        const modifiedNode = structuredClone(node);
        const modFirst = (modifiedNode.children[0] as Paragraph).children[0] as { type: string; value: string };
        modFirst.value = modFirst.value.replace(CALLOUT_REGEX, '');

        const html = childrenToHtml(modifiedNode.children);
        return ['callout', { html, variant }];
      }
    }
  }

  const html = childrenToHtml(node.children);
  return ['quote', { html }];
}

function mapList(node: List): BlockTuple {
  const html = nodeToHtml(node);
  return ['text', { html }];
}

function mapTable(node: Table): BlockTuple {
  const html = nodeToHtml(node);
  return ['text', { html }];
}

function mapHtml(node: Html): BlockTuple {
  return ['text', { html: node.value }];
}

// --- Utilities ---

/** Extract plain text from an inline node (strips all marks) */
function extractPlainText(node: { children?: Content[] }): string {
  if (!node.children) return '';
  return node.children.map((child: Content) => {
    if ('value' in child) return (child as { value: string }).value;
    if ('children' in child) return extractPlainText(child as { children: Content[] });
    return '';
  }).join('');
}

/**
 * Convert inline mdast nodes to HTML string.
 * Uses remark-rehype + rehype-stringify on a synthetic paragraph.
 */
function inlineToHtml(node: Paragraph): string {
  // Build a minimal tree with just this paragraph
  const tree: Root = { type: 'root', children: [node] };
  const result = unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .stringify(
      unified()
        .use(remarkRehype, { allowDangerousHtml: true })
        .runSync(tree),
    );

  // Strip wrapping <p> tags since we add them ourselves
  return result.replace(/^<p>/, '').replace(/<\/p>\s*$/, '').trim();
}

/** Convert mdast children to an HTML string */
function childrenToHtml(children: Content[]): string {
  const tree: Root = { type: 'root', children: children as Root['children'] };
  return unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .stringify(
      unified()
        .use(remarkRehype, { allowDangerousHtml: true })
        .runSync(tree),
    );
}

/** Convert a single mdast node to HTML */
function nodeToHtml(node: Content): string {
  return childrenToHtml([node]);
}

/** Replace [[wikilinks]] with plain text or custom handler output */
function preprocessWikilinks(md: string, handler?: (page: string, text?: string) => string): string {
  return md.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_match, page: string, display?: string) => {
    if (handler) return handler(page, display);
    return display || page;
  });
}
