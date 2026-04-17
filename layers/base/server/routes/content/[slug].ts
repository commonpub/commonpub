import { contentToArticle } from '@commonpub/protocol';
import { contentItems, users } from '@commonpub/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Legacy content URI: /content/:slug
 *
 * AP clients (Accept: application/activity+json) get Article JSON-LD —
 * remote instances still dereference this legacy URI when processing old
 * Create/Announce/Like activities created before the URL restructure.
 *
 * Browsers get a 301 redirect to the canonical /u/:author/:type/:slug URL.
 * Anything else would be a dead 204 (this is a server route, not middleware,
 * and there's no Nuxt page at /content/:slug to fall through to).
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  const slug = getRouterParam(event, 'slug');
  if (!slug) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const config = useConfig();
  const db = useDB();
  const domain = config.instance.domain;

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
      eq(contentItems.slug, slug),
      eq(contentItems.status, 'published'),
      isNull(contentItems.deletedAt),
    ))
    .limit(1);

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }

  // Browser: redirect to canonical URL.
  if (!isAPRequest) {
    return sendRedirect(event, `/u/${row.author.username}/${row.content.type}/${row.content.slug}`, 301);
  }

  // AP: serve Article JSON-LD.
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Federation disabled' });
  }

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
