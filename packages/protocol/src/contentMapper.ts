import { AP_CONTEXT, AP_PUBLIC, type APArticle, type APNote, type APTag, type APCreate } from './activityTypes.js';
import { sanitizeHtml } from './sanitize.js';

/**
 * Render content to HTML for federation.
 * Handles both BlockTuple[] (articles/projects/blogs) and ExplainerDocument (explainers).
 * Remote instances receive clean HTML, not our internal JSONB format.
 */
function contentToHtml(content: unknown): string {
  if (!content) return '';

  // ExplainerDocument format: { version: 2, hero, sections[], conclusion? }
  if (typeof content === 'object' && !Array.isArray(content) && 'version' in (content as Record<string, unknown>) && (content as Record<string, unknown>).version === 2) {
    return explainerDocumentToHtml(content as Record<string, unknown>);
  }

  // BlockTuple[] format
  return blockTuplesToHtml(content);
}

/** Render ExplainerDocument to readable HTML for federation */
function explainerDocumentToHtml(doc: Record<string, unknown>): string {
  const parts: string[] = [];
  const hero = doc.hero as Record<string, unknown> | undefined;
  const sections = doc.sections as Array<Record<string, unknown>> | undefined;
  const conclusion = doc.conclusion as Record<string, unknown> | undefined;

  // Hero
  if (hero) {
    if (hero.title) parts.push(`<h1>${escapeHtml(String(hero.title))}</h1>`);
    if (hero.subtitle) parts.push(`<p><em>${escapeHtml(String(hero.subtitle))}</em></p>`);
  }

  // Sections
  if (sections) {
    for (const section of sections) {
      if (section.heading) parts.push(`<h2>${escapeHtml(String(section.heading))}</h2>`);
      if (section.body) parts.push(sanitizeFederatedHtml(section.body));
      if (section.insight) parts.push(`<aside><strong>Insight:</strong> ${escapeHtml(String(section.insight))}</aside>`);
      if (section.bridge) parts.push(`<p><em>${sanitizeFederatedHtml(section.bridge)}</em></p>`);
    }
  }

  // Conclusion
  if (conclusion) {
    if (conclusion.heading) parts.push(`<h2>${escapeHtml(String(conclusion.heading))}</h2>`);
    if (conclusion.body) parts.push(sanitizeFederatedHtml(conclusion.body));
  }

  return parts.join('\n');
}

function blockTuplesToHtml(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';

  const parts: string[] = [];
  for (const block of blocks) {
    if (!Array.isArray(block) || block.length < 2) continue;
    const [type, data] = block as [string, Record<string, unknown>];

    switch (type) {
      case 'paragraph':
      case 'text':
        if (data.html) parts.push(`<p>${sanitizeFederatedHtml(data.html)}</p>`);
        else if (data.text) parts.push(`<p>${escapeHtml(String(data.text))}</p>`);
        break;
      case 'heading': {
        const level = Math.min(Math.max(Number(data.level) || 2, 1), 6);
        const text = sanitizeFederatedHtml(data.html) || escapeHtml(String(data.text ?? ''));
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
        if (data.html) parts.push(`<blockquote>${sanitizeFederatedHtml(data.html)}</blockquote>`);
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
        parts.push(`<aside>${sanitizeFederatedHtml(data.html) || escapeHtml(String(data.text ?? ''))}</aside>`);
        break;
      case 'markdown':
        if (data.html) parts.push(sanitizeFederatedHtml(data.html));
        else if (data.text) parts.push(`<p>${escapeHtml(String(data.text))}</p>`);
        break;
      case 'build_step': {
        const title = data.title ? `<strong>${escapeHtml(String(data.title))}</strong>` : '';
        const body = sanitizeFederatedHtml(data.html) || escapeHtml(String(data.text ?? ''));
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
        if (data.html) parts.push(`<div>${sanitizeFederatedHtml(data.html)}</div>`);
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

/**
 * Sanitize HTML from TipTap editor block `data.html` fields before federation.
 *
 * Delegates to the package's allowlist-based {@link sanitizeHtml} so that
 * outbound federated HTML is held to the same allowlist as inbound content:
 * only allowlisted elements survive, dangerous attributes (event handlers,
 * `style`) are stripped, and URL schemes are validated. Replaces the previous
 * denylist-only regex (which let unknown tags such as `<iframe>` through).
 */
function sanitizeFederatedHtml(html: unknown): string {
  if (typeof html !== 'string') return '';
  return sanitizeHtml(html);
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
  /** Stored canonical AP object URI — if present, used instead of generating one */
  apObjectId?: string | null;
  /** CommonPub metadata: difficulty, build time, cost, parts, etc. */
  difficulty?: string | null;
  buildTime?: string | null;
  estimatedCost?: string | null;
  parts?: unknown[] | null;
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
  // Use stored AP object ID if available (immutable after first publish).
  // For new content: /u/{username}/{type}/{slug}. Legacy fallback: /content/{slug}.
  const fedType = item.type === 'article' ? 'blog' : item.type;
  const objectId = item.apObjectId
    ?? `https://${domain}/u/${author.username}/${fedType}/${item.slug}`;
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
    content: typeof item.content === 'string' ? item.content : contentToHtml(item.content),
    to: [AP_PUBLIC],
    cc: [followersUri],
    // CommonPub extension: content type (article normalized to blog)
    'cpub:type': item.type === 'article' ? 'blog' : item.type,
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
  // Build attachments: cover image + images from block content
  const attachments: Array<{ type: string; url: string; name?: string }> = [];
  if (item.coverImageUrl) {
    attachments.push({ type: 'Image', url: item.coverImageUrl, name: 'Cover image' });
  }
  // Extract images from blocks
  if (Array.isArray(item.content)) {
    for (const block of item.content as [string, Record<string, unknown>][]) {
      if (!Array.isArray(block) || block.length < 2) continue;
      const [btype, bdata] = block;
      if ((btype === 'image') && typeof bdata.url === 'string') {
        attachments.push({ type: 'Image', url: bdata.url, name: typeof bdata.alt === 'string' ? bdata.alt : undefined });
      } else if (btype === 'gallery' && Array.isArray(bdata.images)) {
        for (const img of bdata.images as Record<string, unknown>[]) {
          if (typeof img.url === 'string') {
            attachments.push({ type: 'Image', url: img.url, name: typeof img.alt === 'string' ? img.alt : undefined });
          }
        }
      }
    }
  }
  if (attachments.length > 0) {
    article.attachment = attachments;
  }
  const normalizedType = item.type === 'article' ? 'blog' : item.type;
  article.url = `https://${domain}/u/${author.username}/${normalizedType}/${item.slug}`;
  if (tags.length > 0) {
    article.tag = tags;
  }

  // CommonPub extension: project metadata (difficulty, cost, parts)
  const cpubMeta: Record<string, unknown> = {};
  if (item.difficulty) cpubMeta.difficulty = item.difficulty;
  if (item.buildTime) cpubMeta.buildTime = item.buildTime;
  if (item.estimatedCost) cpubMeta.estimatedCost = item.estimatedCost;
  if (item.parts?.length) cpubMeta.parts = item.parts;
  if (Object.keys(cpubMeta).length > 0) {
    (article as unknown as Record<string, unknown>)['cpub:metadata'] = cpubMeta;
  }

  // CommonPub extension: original block tuples for CommonPub→CommonPub fidelity.
  // Non-CommonPub instances ignore this; CommonPub instances use it to render
  // full structured content (parts lists, build steps, code blocks, etc.)
  if (Array.isArray(item.content) && item.content.length > 0) {
    (article as unknown as Record<string, unknown>)['cpub:blocks'] = item.content;
  }

  return article;
}

/**
 * Build a Create activity wrapping a content item's AP Article, suitable for an
 * actor's OUTBOX projection.
 *
 * Unlike `buildCreateActivity` (which stamps a RANDOM activity id + `published: now`),
 * this is DETERMINISTIC: the activity id is `<object id>#create` and `published` is the
 * content's real publish time. Both properties are load-bearing for the outbox:
 *  - the outbox is rebuilt on every crawl, so the activity id must be stable (otherwise
 *    every render emits a new id, breaking consumer de-dup / caching), and
 *  - bounded backfill paginates by `published`, so it must reflect the real date, not "now".
 *
 * De-dup on the consumer side keys on `object.id` (the content's canonical AP URI), so
 * sharing this builder between live delivery and the outbox never produces duplicates.
 */
export function contentToCreateActivity(
  item: ContentItemInput,
  author: AuthorInput,
  domain: string,
): APCreate {
  const actorUri = `https://${domain}/users/${author.username}`;
  const article = contentToArticle(item, author, domain);
  return {
    '@context': AP_CONTEXT,
    type: 'Create',
    id: `${article.id}#create`,
    actor: actorUri,
    object: article,
    to: article.to,
    cc: article.cc,
    published: article.published ?? item.publishedAt?.toISOString(),
  };
}

/** Escape HTML for safe embedding in AP objects */
export function escapeHtmlForAP(text: string): string {
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
