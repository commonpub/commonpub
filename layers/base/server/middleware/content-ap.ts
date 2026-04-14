import { contentToArticle } from '@commonpub/protocol';
import { contentItems, users } from '@commonpub/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';

/**
 * Middleware: serve ActivityPub Article JSON-LD for content URIs.
 *
 * Matches /u/{username}/{type}/{slug} with AP Accept headers.
 * Non-AP requests pass through to the Nuxt page renderer.
 *
 * This MUST be a middleware (not a server route) because a server route
 * returning undefined sends HTTP 204, which prevents the Nuxt page from rendering.
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  if (!isAPRequest) return;

  const path = getRequestURL(event).pathname;
  const match = path.match(/^\/u\/([a-zA-Z0-9_-]+)\/([a-z]+)\/([a-z0-9][a-z0-9_-]*)$/);
  if (!match) return;

  const config = useConfig();
  if (!config.features.federation) return;

  const [, username, rawType, slug] = match;
  if (!username || !rawType || !slug) return;
  const type = rawType === 'article' ? 'blog' : rawType; // normalize article→blog

  const db = useDB();
  const domain = config.instance.domain;

  // For blog type, also match 'article' in DB (transition: pre-migration rows still have type='article')
  const typeFilter = type === 'blog'
    ? inArray(contentItems.type, ['blog', 'article'])
    : eq(contentItems.type, type as 'project' | 'explainer');

  const [row] = await db
    .select({
      content: contentItems,
      author: {
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(and(
      eq(users.username, username),
      typeFilter,
      eq(contentItems.slug, slug),
      eq(contentItems.status, 'published'),
      isNull(contentItems.deletedAt),
    ))
    .limit(1);

  if (!row) return;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  return contentToArticle(
    {
      id: row.content.id,
      type: row.content.type,
      title: row.content.title,
      slug: row.content.slug,
      description: row.content.description,
      content: typeof row.content.content === 'string'
        ? row.content.content
        : JSON.stringify(row.content.content),
      coverImageUrl: row.content.coverImageUrl,
      publishedAt: row.content.publishedAt,
      updatedAt: row.content.updatedAt,
    },
    { username: row.author.username, displayName: row.author.displayName ?? row.author.username },
    domain,
  );
});
