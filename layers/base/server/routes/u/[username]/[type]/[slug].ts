import { contentToArticle } from '@commonpub/protocol';
import { contentItems, users } from '@commonpub/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * New-format content AP Article endpoint.
 * URI: /u/{username}/{type}/{slug}
 *
 * Serves Article JSON-LD when requested with AP Accept header.
 * Browsers see the Nuxt page instead (this handler returns nothing for non-AP requests).
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  if (!isAPRequest) return;

  const config = useConfig();
  if (!config.features.federation) return;

  const username = getRouterParam(event, 'username');
  const type = getRouterParam(event, 'type');
  const slug = getRouterParam(event, 'slug');
  if (!username || !type || !slug) return;

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
      eq(users.username, username),
      eq(contentItems.type, type as 'project' | 'article' | 'blog' | 'explainer'),
      eq(contentItems.slug, slug),
      eq(contentItems.status, 'published'),
      isNull(contentItems.deletedAt),
    ))
    .limit(1);

  if (!row) return;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  const article = contentToArticle(
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

  return article;
});
