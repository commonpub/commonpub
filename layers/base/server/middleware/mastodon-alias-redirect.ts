import { users, hubs } from '@commonpub/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Redirect /@handle → canonical profile URL.
 *
 * WebFinger advertises `/@username` as the `profile-page` (Mastodon/Fediverse
 * convention) — without this middleware, that URL falls through to the
 * `[type]/index.vue` catchall and renders a broken content listing for
 * "@usernames". Federated users clicking a CommonPub member's profile from
 * Mastodon end up on a broken page.
 *
 * Matches /@{handle} exactly (no sub-paths). Looks up users first, then hubs
 * (both are advertised via WebFinger). Misses 404.
 */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;
  const match = path.match(/^\/@([a-zA-Z0-9._-]+)$/);
  if (!match) return;

  const handle = match[1]!;
  const db = useDB();

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(and(eq(users.username, handle), isNull(users.deletedAt)))
    .limit(1);

  if (user) {
    return sendRedirect(event, `/u/${user.username}`, 301);
  }

  const [hub] = await db
    .select({ slug: hubs.slug })
    .from(hubs)
    .where(and(eq(hubs.slug, handle), isNull(hubs.deletedAt)))
    .limit(1);

  if (hub) {
    return sendRedirect(event, `/hubs/${hub.slug}`, 301);
  }

  throw createError({ statusCode: 404, statusMessage: 'Not Found' });
});
