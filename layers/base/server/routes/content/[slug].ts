import { contentToArticle } from '@commonpub/protocol';
import { contentItems, users } from '@commonpub/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Content AP Article endpoint.
 * Serves Article JSON-LD when requested with AP Accept header.
 * Remote instances dereference this URI when processing:
 * - Create activities (content federation)
 * - Announce activities (hub share federation)
 * - Like/Boost activities targeting content
 */
export default defineEventHandler(async (event) => {
  const accept = getRequestHeader(event, 'accept') ?? '';
  const isAPRequest =
    accept.includes('application/activity+json') ||
    accept.includes('application/ld+json');

  if (!isAPRequest) return;

  const config = useConfig();
  if (!config.features.federation) return;

  const slug = getRouterParam(event, 'slug');
  if (!slug) return;

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

  if (!row) return;

  setResponseHeader(event, 'content-type', 'application/activity+json');

  // Render the content as an AP Article with all CommonPub extensions
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
