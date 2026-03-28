import { AP_CONTEXT, AP_PUBLIC, type APArticle, type APNote, type APTag } from './activityTypes.js';

/**
 * Render BlockTuple[] content to HTML for federation.
 * Remote instances receive clean HTML, not our internal JSONB format.
 */
function blockTuplesToHtml(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';

  const parts: string[] = [];
  for (const block of blocks) {
    if (!Array.isArray(block) || block.length < 2) continue;
    const [type, data] = block as [string, Record<string, unknown>];

    switch (type) {
      case 'paragraph':
      case 'text':
        if (data.html) parts.push(`<p>${data.html}</p>`);
        else if (data.text) parts.push(`<p>${escapeHtml(String(data.text))}</p>`);
        break;
      case 'heading': {
        const level = Math.min(Math.max(Number(data.level) || 2, 1), 6);
        const text = data.html || escapeHtml(String(data.text ?? ''));
        parts.push(`<h${level}>${text}</h${level}>`);
        break;
      }
      case 'image':
        if (data.url) {
          const alt = data.alt ? ` alt="${escapeAttr(String(data.alt))}"` : '';
          const caption = data.caption ? `<figcaption>${escapeHtml(String(data.caption))}</figcaption>` : '';
          parts.push(`<figure><img src="${escapeAttr(String(data.url))}"${alt} />${caption}</figure>`);
        }
        break;
      case 'code_block':
      case 'code':
        if (data.code) {
          const lang = data.language ? ` class="language-${escapeAttr(String(data.language))}"` : '';
          parts.push(`<pre><code${lang}>${escapeHtml(String(data.code))}</code></pre>`);
        }
        break;
      case 'quote':
      case 'blockquote':
        if (data.html) parts.push(`<blockquote>${data.html}</blockquote>`);
        else if (data.text) parts.push(`<blockquote><p>${escapeHtml(String(data.text))}</p></blockquote>`);
        break;
      case 'divider':
        parts.push('<hr />');
        break;
      case 'video':
        if (data.url) parts.push(`<p><a href="${escapeAttr(String(data.url))}">Video: ${escapeHtml(String(data.title ?? data.url))}</a></p>`);
        break;
      case 'embed':
        if (data.url) parts.push(`<p><a href="${escapeAttr(String(data.url))}">${escapeHtml(String(data.title ?? 'Embedded content'))}</a></p>`);
        break;
      case 'callout':
        parts.push(`<aside>${data.html || escapeHtml(String(data.text ?? ''))}</aside>`);
        break;
      case 'markdown':
        // Markdown blocks store pre-rendered HTML
        if (data.html) parts.push(String(data.html));
        else if (data.text) parts.push(`<p>${escapeHtml(String(data.text))}</p>`);
        break;
      case 'build_step': {
        const title = data.title ? `<strong>${escapeHtml(String(data.title))}</strong>` : '';
        const body = data.html || escapeHtml(String(data.text ?? ''));
        parts.push(`<div>${title}${body ? `<p>${body}</p>` : ''}</div>`);
        break;
      }
      case 'parts_list': {
        const items = Array.isArray(data.parts) ? data.parts : [];
        if (items.length > 0) {
          const lis = items.map((p: Record<string, unknown>) =>
            `<li>${escapeHtml(String(p.name ?? ''))}${p.quantity ? ` (x${p.quantity})` : ''}</li>`
          ).join('');
          parts.push(`<h3>Parts</h3><ul>${lis}</ul>`);
        }
        break;
      }
      default:
        // Unknown block types: try html, text, or skip
        if (data.html) parts.push(`<div>${data.html}</div>`);
        else if (data.text) parts.push(`<p>${escapeHtml(String(data.text))}</p>`);
        break;
    }
  }

  return parts.join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface ContentItemInput {
  id: string;
  type: string;
  title: string;
  slug: string;
  description?: string | null;
  content?: unknown;
  coverImageUrl?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  /** Tag names to include as AP Hashtag objects */
  tags?: string[];
}

export interface AuthorInput {
  username: string;
  displayName?: string | null;
}

export interface CommentInput {
  id: string;
  content: string;
  targetId: string;
  targetType: string;
  createdAt?: Date | null;
}

/** Map a CommonPub content item to an AP Article */
export function contentToArticle(
  item: ContentItemInput,
  author: AuthorInput,
  domain: string,
): APArticle {
  const actorUri = `https://${domain}/users/${author.username}`;
  const objectId = `https://${domain}/content/${item.slug}`;
  const followersUri = `${actorUri}/followers`;

  const tags: APTag[] = (item.tags ?? []).map((name) => ({
    type: 'Hashtag' as const,
    name: name.startsWith('#') ? name : `#${name}`,
    href: `https://${domain}/search?tag=${encodeURIComponent(name.replace(/^#/, ''))}`,
  }));

  const article: APArticle = {
    '@context': AP_CONTEXT,
    type: 'Article',
    id: objectId,
    attributedTo: actorUri,
    name: item.title,
    content: typeof item.content === 'string' ? item.content : blockTuplesToHtml(item.content),
    to: [AP_PUBLIC],
    cc: [followersUri],
    // CommonPub extension: original content type (project, article, blog, explainer)
    'cpub:type': item.type,
  } as APArticle;

  if (item.description) {
    article.summary = item.description;
  }
  if (item.publishedAt) {
    article.published = item.publishedAt.toISOString();
  }
  if (item.updatedAt) {
    article.updated = item.updatedAt.toISOString();
  }
  if (item.coverImageUrl) {
    article.attachment = [{ type: 'Image', url: item.coverImageUrl, name: 'Cover image' }];
  }
  article.url = `https://${domain}/${item.type}/${item.slug}`;
  if (tags.length > 0) {
    article.tag = tags;
  }

  return article;
}

/** Escape HTML for safe embedding in AP objects */
function escapeHtmlForAP(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Map a CommonPub comment to an AP Note */
export function contentToNote(
  comment: CommentInput,
  author: AuthorInput,
  domain: string,
  parentObjectUri?: string,
): APNote {
  const actorUri = `https://${domain}/users/${author.username}`;
  const objectId = `https://${domain}/comments/${comment.id}`;
  const followersUri = `${actorUri}/followers`;

  const note: APNote = {
    '@context': AP_CONTEXT,
    type: 'Note',
    id: objectId,
    attributedTo: actorUri,
    content: escapeHtmlForAP(comment.content),
    to: [AP_PUBLIC],
    cc: [followersUri],
  };

  if (parentObjectUri) {
    note.inReplyTo = parentObjectUri;
  }
  if (comment.createdAt) {
    note.published = comment.createdAt.toISOString();
  }

  return note;
}

/** Parse an AP Article into a content insert shape */
export function articleToContent(article: APArticle): {
  title: string;
  content: string;
  description?: string;
  coverImageUrl?: string;
  publishedAt?: Date;
} {
  const result: {
    title: string;
    content: string;
    description?: string;
    coverImageUrl?: string;
    publishedAt?: Date;
  } = {
    title: article.name,
    content: article.content,
  };

  if (article.summary) {
    result.description = article.summary;
  }
  if (article.published) {
    result.publishedAt = new Date(article.published);
  }

  const imageAttachment = article.attachment?.find((a) => a.type === 'Image');
  if (imageAttachment) {
    result.coverImageUrl = imageAttachment.url;
  }

  return result;
}

/** Parse an AP Note into a comment insert shape */
export function noteToComment(note: APNote): {
  content: string;
  inReplyTo?: string;
} {
  return {
    content: note.content,
    inReplyTo: note.inReplyTo,
  };
}
