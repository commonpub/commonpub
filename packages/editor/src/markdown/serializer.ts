/**
 * BlockTuple[] → Markdown string serializer.
 * Converts block tuples back to markdown for export.
 */
import type { BlockTuple } from '../blocks/types.js';

/**
 * Convert BlockTuple[] to a markdown string.
 */
export function blockTuplesToMarkdown(blocks: BlockTuple[]): string {
  const parts: string[] = [];

  for (const [type, content] of blocks) {
    const md = serializeBlock(type, content as Record<string, unknown>);
    if (md !== null) {
      parts.push(md);
    }
  }

  return parts.join('\n\n');
}

function serializeBlock(type: string, content: Record<string, unknown>): string | null {
  switch (type) {
    case 'text':
      return htmlToMarkdown(content.html as string);
    case 'heading': {
      const level = Math.min(Math.max(content.level as number, 1), 4);
      const hashes = '#'.repeat(level);
      return `${hashes} ${content.text as string}`;
    }
    case 'code': {
      const lang = content.language as string || '';
      const filename = content.filename as string | undefined;
      const info = filename ? `${lang}:${filename}` : lang;
      return `\`\`\`${info}\n${content.code as string}\n\`\`\``;
    }
    case 'image': {
      const alt = content.alt as string || '';
      const caption = content.caption as string || '';
      const md = `![${alt}](${content.src as string})`;
      return caption ? `${md}\n*${caption}*` : md;
    }
    case 'quote':
      return blockquoteLines(htmlToMarkdown(content.html as string));
    case 'callout': {
      const variant = content.variant as string || 'info';
      const typeMap: Record<string, string> = { info: 'NOTE', tip: 'TIP', warning: 'WARNING', danger: 'DANGER' };
      const label = typeMap[variant] || 'NOTE';
      const body = htmlToMarkdown(content.html as string);
      return `> [!${label}]\n${blockquoteLines(body)}`;
    }
    case 'divider':
      return '---';
    case 'markdown':
      return content.source as string;
    case 'video':
      return `[Video](${content.url as string})`;
    case 'embed':
      return `[Embed](${content.url as string})`;
    case 'gallery': {
      const images = content.images as Array<{ src: string; alt: string }> || [];
      return images.map(img => `![${img.alt || ''}](${img.src})`).join('\n\n');
    }
    case 'mathNotation':
      return `$$\n${content.expression as string}\n$$`;
    case 'partsList': {
      const parts = content.parts as Array<{ name: string; qty?: number; price?: string }> || [];
      if (parts.length === 0) return null;
      const rows = parts.map(p => `| ${p.name} | ${p.qty ?? 1} | ${p.price || '-'} |`);
      return `| Part | Qty | Price |\n| --- | --- | --- |\n${rows.join('\n')}`;
    }
    case 'buildStep': {
      const title = content.title as string || '';
      const body = content.html as string || content.description as string || '';
      return `### ${title}\n\n${htmlToMarkdown(body)}`;
    }
    case 'toolList': {
      const tools = content.tools as Array<{ name: string; url?: string }> || [];
      return tools.map(t => t.url ? `- [${t.name}](${t.url})` : `- ${t.name}`).join('\n');
    }
    case 'downloads': {
      const files = content.files as Array<{ name: string; url: string }> || [];
      return files.map(f => `- [${f.name}](${f.url})`).join('\n');
    }
    case 'sectionHeader':
      return `## ${content.title as string || ''}`;
    default:
      return null;
  }
}

/** Simple HTML → markdown conversion for inline content */
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<del>(.*?)<\/del>/gi, '~~$1~~')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<ul>(.*?)<\/ul>/gis, (_, inner: string) =>
      inner.replace(/<li>(.*?)<\/li>/gi, '- $1').trim(),
    )
    .replace(/<ol>(.*?)<\/ol>/gis, (_, inner: string) => {
      let i = 0;
      return inner.replace(/<li>(.*?)<\/li>/gi, () => `${++i}. `).trim();
    })
    .replace(/<[^>]+>/g, '') // Strip remaining tags
    .trim();
}

/** Prefix each line with `> ` for blockquotes */
function blockquoteLines(text: string): string {
  return text.split('\n').map(line => `> ${line}`).join('\n');
}
