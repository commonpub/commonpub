/**
 * Generic content importer — works with any article/blog page.
 * Uses Mozilla Readability for article extraction and Turndown for HTML→Markdown.
 */
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { parseHTML } from 'linkedom';
import { markdownToBlockTuples } from '@commonpub/editor';
import type { ImportResult } from './types.js';

/**
 * Extract article content from raw HTML using Readability + Turndown.
 * This is the fallback for any URL without a platform-specific handler.
 */
export function extractArticle(html: string, url: string): ImportResult {
  const { document } = parseHTML(html);

  // Extract metadata from <head> before Readability modifies the DOM
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content')
    ?? document.querySelector('meta[name="description"]')?.getAttribute('content');
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');

  const reader = new Readability(document, { charThreshold: 100 });
  const article = reader.parse();

  if (!article || !article.content) {
    return {
      title: ogTitle || document.title || '',
      description: ogDescription || '',
      coverImageUrl: resolveUrl(ogImage, url),
      content: [],
      tags: parseKeywords(metaKeywords),
      partial: true,
      meta: {},
    };
  }

  const turndown = createTurndownService();
  const markdown = turndown.turndown(article.content);
  const blocks = markdownToBlockTuples(markdown);

  return {
    title: article.title || ogTitle || '',
    description: article.excerpt || ogDescription || '',
    coverImageUrl: resolveUrl(ogImage, url),
    content: blocks,
    tags: parseKeywords(metaKeywords),
    partial: false,
    meta: {
      siteName: article.siteName || undefined,
      byline: article.byline || undefined,
      wordCount: countWords(article.textContent || ''),
    },
  };
}

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });

  // Preserve code blocks with language hints
  td.addRule('fencedCodeBlock', {
    filter: (node) => {
      return node.nodeName === 'PRE' && !!node.querySelector('code');
    },
    replacement: (_content, node) => {
      const codeEl = (node as Element).querySelector('code');
      if (!codeEl) return _content;
      const lang = extractCodeLanguage(codeEl);
      const code = codeEl.textContent || '';
      return `\n\n\`\`\`${lang}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
    },
  });

  // Convert iframes (YouTube, etc.) to markdown links
  td.addRule('iframe', {
    filter: 'iframe',
    replacement: (_content, node) => {
      const src = (node as Element).getAttribute('src');
      if (!src) return '';
      return `\n\n[Embedded content](${src})\n\n`;
    },
  });

  return td;
}

function extractCodeLanguage(codeEl: Element): string {
  const className = codeEl.getAttribute('class') || '';
  const match = className.match(/(?:language-|lang-)(\w+)/);
  if (match?.[1]) return match[1];

  // Highlight.js uses "hljs language-xxx"
  const hljsMatch = className.match(/\bhljs\b.*?\b(\w+)\b/);
  if (hljsMatch?.[1] && hljsMatch[1] !== 'hljs') return hljsMatch[1];

  return '';
}

function resolveUrl(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function parseKeywords(keywords: string | null | undefined): string[] {
  if (!keywords) return [];
  return keywords.split(',').map(k => k.trim()).filter(Boolean).slice(0, 20);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
