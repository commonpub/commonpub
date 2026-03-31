import { getLessonBySlug } from '@commonpub/server';
import { renderMarkdown } from '@commonpub/docs';

function blocksToHtml(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  const parts: string[] = [];
  for (const block of blocks) {
    const [type, data] = block as [string, Record<string, unknown>];
    if (!data) continue;
    if (typeof data.html === 'string' && data.html) {
      parts.push(data.html);
    } else if (type === 'heading' && typeof data.text === 'string') {
      const level = Math.min(Math.max(Number(data.level) || 2, 1), 6);
      const escaped = data.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      parts.push(`<h${level}>${escaped}</h${level}>`);
    } else if (type === 'code_block' && typeof data.code === 'string') {
      const lang = String(data.language || '').replace(/[^a-zA-Z0-9-]/g, '');
      const escaped = data.code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      parts.push(`<pre><code class="language-${lang}">${escaped}</code></pre>`);
    } else if (type === 'image' && (data.src || data.url)) {
      const src = String(data.src || data.url).replace(/"/g, '&quot;');
      const alt = String(data.alt || '').replace(/"/g, '&quot;');
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
        parts.push(`<figure><img src="${src}" alt="${alt}" /></figure>`);
      }
    } else if (type === 'blockquote' && typeof data.text === 'string') {
      const escaped = data.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      parts.push(`<blockquote>${escaped}</blockquote>`);
    } else if (type === 'callout' && typeof data.text === 'string') {
      const escaped = data.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      parts.push(`<div class="cpub-callout">${escaped}</div>`);
    } else if (type === 'horizontal_rule' || type === 'divider') {
      parts.push('<hr />');
    }
  }
  return parts.join('\n');
}

export default defineEventHandler(async (event) => {
  const db = useDB();
  const { slug, lessonSlug } = parseParams(event, { slug: 'string', lessonSlug: 'string' });

  const result = await getLessonBySlug(db, slug, lessonSlug);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Lesson not found' });
  }

  let renderedHtml = '';

  if (result.linkedContent?.content) {
    // Linked content uses BlockTuple[] format
    renderedHtml = blocksToHtml(result.linkedContent.content);
  } else {
    // Inline content: render markdown
    const content = result.lesson.content as Record<string, unknown> | null;
    if (content) {
      const md = typeof content.markdown === 'string' ? content.markdown
        : typeof content.notes === 'string' ? content.notes
        : '';
      if (md) {
        const rendered = await renderMarkdown(md);
        renderedHtml = rendered.html;
      }
    }
  }

  return { ...result, renderedHtml };
});
