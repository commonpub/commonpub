/**
 * Platform-specific handler for hackster.io projects.
 * Extracts structured project data (parts, difficulty, steps) beyond
 * what the generic article extractor can handle.
 */
import TurndownService from 'turndown';
import { parseHTML } from 'linkedom';
import { markdownToBlockTuples } from '@commonpub/editor';
import type { BlockTuple } from '@commonpub/editor';
import type { ImportResult, PlatformHandler } from '../types.js';

const ALGOLIA_APP_ID = '7YQJT9BHUX';
const ALGOLIA_API_KEY = 'c113f0569e873258342405ddf4a4dd09';
const ALGOLIA_INDEX = 'hackster_production_project';

export const hacksterHandler: PlatformHandler = {
  match(url: URL): boolean {
    return url.hostname === 'www.hackster.io' || url.hostname === 'hackster.io';
  },

  async import(url: URL, html: string): Promise<ImportResult> {
    const slug = extractProjectSlug(url);
    const { document } = parseHTML(html);

    // Try Algolia for structured metadata
    const algoliaData = slug ? await fetchAlgoliaData(slug) : null;

    // Extract story content from the SSR HTML
    const storyHtml = extractStoryHtml(document);
    const partsData = extractPartsFromHtml(document);

    const turndown = createTurndownService();

    let blocks: BlockTuple[] = [];
    let partial = false;

    if (storyHtml) {
      const markdown = turndown.turndown(storyHtml);
      blocks = markdownToBlockTuples(markdown);
    } else {
      partial = true;
    }

    // Build parts list block if we have parts
    const parts = mergePartsData(partsData, algoliaData?.parts);
    if (parts.length > 0) {
      const partsBlock: BlockTuple = ['partsList', {
        parts: parts.map(p => ({
          name: p.name,
          qty: p.qty ?? 1,
          url: p.url || undefined,
          category: p.category || undefined,
        })),
      }];
      blocks = [partsBlock, ...blocks];
    }

    // Extract tools if present
    const toolsHtml = extractToolsHtml(document);
    if (toolsHtml) {
      const toolNames = extractListItems(toolsHtml);
      if (toolNames.length > 0) {
        const toolBlock: BlockTuple = ['toolList', {
          tools: toolNames.map(name => ({ name })),
        }];
        // Insert tools after parts list (or at start if no parts)
        const insertIdx = parts.length > 0 ? 1 : 0;
        blocks.splice(insertIdx, 0, toolBlock);
      }
    }

    const title = algoliaData?.name
      ?? document.querySelector('h1')?.textContent?.trim()
      ?? document.title?.replace(/ \| Hackster\.io$/, '')
      ?? '';

    const description = algoliaData?.pitch
      ?? document.querySelector('meta[property="og:description"]')?.getAttribute('content')
      ?? '';

    const coverImageUrl: string | null = algoliaData?.cover_image_url
      ?? document.querySelector('meta[property="og:image"]')?.getAttribute('content')
      ?? null;

    const tags: string[] = [];
    if (algoliaData?.platforms) tags.push(...algoliaData.platforms);
    if (algoliaData?.programming_languages) tags.push(...algoliaData.programming_languages);

    return {
      title,
      description,
      coverImageUrl,
      content: blocks,
      tags: [...new Set(tags)].slice(0, 20),
      partial,
      meta: {
        difficulty: algoliaData?.difficulty ?? undefined,
        platforms: algoliaData?.platforms ?? undefined,
        sourceType: 'project',
      },
    };
  },
};

function extractProjectSlug(url: URL): string | null {
  // URL pattern: /username/project-slug
  const segments = url.pathname.split('/').filter(Boolean);
  return segments[1] ?? null;
}

interface AlgoliaHit {
  name?: string;
  pitch?: string;
  cover_image_url?: string;
  difficulty?: string;
  platforms?: string[];
  programming_languages?: string[];
  parts?: Array<{ full_name?: string; name?: string }>;
}

async function fetchAlgoliaData(slug: string): Promise<AlgoliaHit | null> {
  try {
    const response = await fetch(
      `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`,
      {
        method: 'POST',
        headers: {
          'X-Algolia-Application-Id': ALGOLIA_APP_ID,
          'X-Algolia-API-Key': ALGOLIA_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: slug.replace(/-/g, ' '),
          hitsPerPage: 5,
          attributesToRetrieve: [
            'name', 'pitch', 'cover_image_url', 'difficulty',
            'platforms', 'programming_languages', 'parts',
            'slug',
          ],
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) return null;

    const data = await response.json() as { hits?: AlgoliaHit[] };
    if (!data.hits?.length) return null;

    // Find the best match by slug similarity
    const bestMatch = data.hits.find(
      (h: AlgoliaHit & { slug?: string }) => h.slug === slug,
    ) ?? data.hits[0];

    return bestMatch ?? null;
  } catch {
    return null;
  }
}

interface PartInfo {
  name: string;
  qty?: number;
  url?: string;
  category?: string;
}

function extractStoryHtml(document: Document): string | null {
  // Primary: itemprop="text" (the main story content)
  const storyEl = document.querySelector('[itemprop="text"]')
    ?? document.querySelector('.project-story')
    ?? document.querySelector('[class*="story"]');

  if (!storyEl) return null;

  const html = storyEl.innerHTML?.trim();
  return html && html.length > 50 ? html : null;
}

function extractPartsFromHtml(document: Document): PartInfo[] {
  const parts: PartInfo[] = [];

  // Look for hardware components section
  const thingsSection = document.querySelector('.project-things')
    ?? document.querySelector('[class*="things"]')
    ?? document.querySelector('[class*="components"]');

  if (!thingsSection) return parts;

  const items = thingsSection.querySelectorAll('li, [class*="component"]');
  for (const item of items) {
    const name = item.textContent?.trim();
    if (name) {
      const link = (item as Element).querySelector?.('a');
      parts.push({
        name: name.replace(/×\s*\d+/g, '').trim(),
        qty: extractQty(item.textContent || ''),
        url: link?.getAttribute?.('href') || undefined,
      });
    }
  }

  return parts;
}

function extractToolsHtml(document: Document): string | null {
  const toolsSection = document.querySelector('.project-tools')
    ?? document.querySelector('[class*="tools-used"]');
  if (!toolsSection) return null;
  return toolsSection.innerHTML?.trim() || null;
}

function extractListItems(html: string): string[] {
  const { document } = parseHTML(`<div>${html}</div>`);
  const items: string[] = [];
  for (const li of document.querySelectorAll('li')) {
    const text = li.textContent?.trim();
    if (text) items.push(text);
  }
  return items;
}

function extractQty(text: string): number {
  const match = text.match(/×\s*(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 1;
}

function mergePartsData(htmlParts: PartInfo[], algoliaParts?: Array<{ full_name?: string; name?: string }>): PartInfo[] {
  if (htmlParts.length > 0) return htmlParts;
  if (!algoliaParts?.length) return [];
  return algoliaParts.map(p => ({
    name: p.full_name || p.name || 'Unknown',
    qty: 1,
  }));
}

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  td.addRule('fencedCodeBlock', {
    filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
    replacement: (_content, node) => {
      const codeEl = (node as Element).querySelector('code');
      if (!codeEl) return _content;
      const className = codeEl.getAttribute('class') || '';
      const lang = className.match(/(?:language-|lang-)(\w+)/)?.[1] || '';
      const code = codeEl.textContent || '';
      return `\n\n\`\`\`${lang}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
    },
  });

  td.addRule('iframe', {
    filter: 'iframe',
    replacement: (_content, node) => {
      const src = (node as Element).getAttribute('src');
      return src ? `\n\n[Embedded content](${src})\n\n` : '';
    },
  });

  return td;
}
