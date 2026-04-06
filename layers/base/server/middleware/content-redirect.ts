import { contentItems, users } from '@commonpub/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Server middleware: redirect old content URLs /{type}/{slug} → /u/{author}/{type}/{slug}.
 *
 * Runs before page rendering so the client receives a real HTTP 301,
 * not a client-side navigation after a 200.
 *
 * Only matches known content types to avoid intercepting /hubs, /learn, /docs, etc.
 */
const CONTENT_TYPES = new Set(['project', 'article', 'blog', 'explainer']);

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Match /{type}/{slug} or /{type}/{slug}/edit — only for known content types
  const match = path.match(/^\/([a-z]+)\/([a-z0-9][a-z0-9-]*)(\/(edit))?$/);
  if (!match) return;

  const type = match[1]!;
  const slug = match[2]!;
  const isEdit = !!match[4];

  if (!CONTENT_TYPES.has(type)) return;

  // Skip AP requests — the old /content/[slug].ts AP route handles those
  const accept = getRequestHeader(event, 'accept') ?? '';
  if (accept.includes('application/activity+json') || accept.includes('application/ld+json')) return;

  // /{type}/new/edit → /u/{username}/{type}/new/edit (requires auth context)
  if (slug === 'new' && isEdit) {
    // Can't redirect without knowing the user — let the page handler do it client-side
    return;
  }

  // Look up the content author for existing content
  const db = useDB();
  const [row] = await db
    .select({ username: users.username, type: contentItems.type, slug: contentItems.slug })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(and(eq(contentItems.slug, slug), isNull(contentItems.deletedAt)))
    .limit(1);

  if (!row) return; // Content not found — let the page handler show 404

  const newPath = isEdit
    ? `/u/${row.username}/${row.type}/${row.slug}/edit`
    : `/u/${row.username}/${row.type}/${row.slug}`;

  // Preserve query string
  const query = getRequestURL(event).search;

  return sendRedirect(event, `${newPath}${query}`, 301);
});
