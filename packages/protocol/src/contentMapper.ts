import { AP_CONTEXT, AP_PUBLIC, type APArticle, type APNote, type APTag } from './activityTypes.js';

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
    content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content ?? ''),
    to: [AP_PUBLIC],
    cc: [followersUri],
  };

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
