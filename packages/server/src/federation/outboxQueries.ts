/**
 * Outbox queries — serve paginated outbound activities for AP actor outboxes.
 * Used by /actor/outbox (instance) and /users/[username]/outbox (per-user) routes.
 *
 * Content outboxes (instance + per-user) are a PROJECTION over published content
 * (`content_items`), NOT a scan of the `activities` delivery queue. This matters:
 * the queue only ever held activities that were *delivered* to a follower, so anything
 * published before a mirror followed (or whose delivery stalled) was invisible forever —
 * a mirror's backfill saw an almost-empty outbox. Projecting over `content_items` makes
 * the outbox reflect the actor's actual published catalogue, so bounded backfill works.
 *
 * SECURITY: the projection gates `status='published' AND visibility='public'`. The outbox
 * is publicly crawlable, so members-only / private content must never appear here (this
 * also keeps the outbox consistent with what `federateContent` is allowed to deliver).
 * `content_type` is intentionally NOT filtered: every value of `contentTypeEnum`
 * (project/article/blog/explainer) federates; non-federating surfaces (docs, learning,
 * videos, …) are separate tables, not `content_items`.
 *
 * Ordering is `published_at DESC NULLS LAST, id DESC` to reuse `idx_content_items_feed_recency`
 * (migration 0012) and give a stable, newest-first order (so a date-bounded backfill can
 * stop early once it pages past its cutoff).
 *
 * Hub outboxes remain queue-derived (Announce activities) — hub federation is a separate
 * Group-actor path and is out of scope here.
 */
import { eq, and, sql, desc, inArray, isNull } from 'drizzle-orm';
import { activities, contentItems, contentTags, tags, users } from '@commonpub/schema';
import { contentToCreateActivity, type ContentItemInput } from '@commonpub/protocol';
import type { DB } from '../types.js';

const DEFAULT_PAGE_SIZE = 20;

/** Extract the local username from a user actor URI (`https://domain/users/alice` → `alice`). */
function usernameFromActorUri(actorUri: string): string | null {
  const m = /\/users\/([^/]+)\/?$/.exec(actorUri);
  return m?.[1] ?? null;
}

/** Count published+public, non-deleted content rows matching an optional author filter. */
async function countContentOutbox(db: DB, authorId?: string): Promise<number> {
  const where = and(
    eq(contentItems.status, 'published'),
    eq(contentItems.visibility, 'public'),
    isNull(contentItems.deletedAt),
    ...(authorId ? [eq(contentItems.authorId, authorId)] : []),
  );
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentItems)
    .where(where);
  return result?.count ?? 0;
}

/**
 * Page of Create activities projected from published+public content.
 * `authorId` undefined → instance outbox (all authors); set → that user's outbox.
 */
async function getContentOutboxPage(
  db: DB,
  domain: string,
  page: number,
  pageSize: number,
  authorId?: string,
): Promise<Record<string, unknown>[]> {
  const offset = (page - 1) * pageSize;
  const where = and(
    eq(contentItems.status, 'published'),
    eq(contentItems.visibility, 'public'),
    isNull(contentItems.deletedAt),
    ...(authorId ? [eq(contentItems.authorId, authorId)] : []),
  );

  const rows = await db
    .select({
      content: contentItems,
      author: { username: users.username, displayName: users.displayName },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(where)
    .orderBy(sql`${contentItems.publishedAt} desc nulls last`, desc(contentItems.id))
    .limit(pageSize)
    .offset(offset);

  if (rows.length === 0) return [];

  // Batch-fetch tags for this page (avoid N+1).
  const contentIds = rows.map((r) => r.content.id);
  const tagRows = await db
    .select({ contentId: contentTags.contentId, name: tags.name })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(inArray(contentTags.contentId, contentIds));
  const tagsByContent = new Map<string, string[]>();
  for (const tr of tagRows) {
    const arr = tagsByContent.get(tr.contentId) ?? [];
    arr.push(tr.name);
    tagsByContent.set(tr.contentId, arr);
  }

  return rows.map((r) => {
    const input = { ...r.content, tags: tagsByContent.get(r.content.id) ?? [] } as unknown as ContentItemInput;
    return contentToCreateActivity(input, r.author, domain) as unknown as Record<string, unknown>;
  });
}

/**
 * Count outbox items for a specific user actor (published+public content by that author).
 */
export async function countOutboxItems(db: DB, actorUri: string): Promise<number> {
  const username = usernameFromActorUri(actorUri);
  if (!username) return 0;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (!u) return 0;
  return countContentOutbox(db, u.id);
}

/**
 * Count outbox items for the instance actor (all users' published+public content).
 */
export async function countInstanceOutboxItems(db: DB, _domain: string): Promise<number> {
  return countContentOutbox(db);
}

/**
 * Page of a specific user actor's outbox (projected from their published+public content).
 */
export async function getOutboxPage(
  db: DB,
  actorUri: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Record<string, unknown>[]> {
  const username = usernameFromActorUri(actorUri);
  if (!username) return [];
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (!u) return [];
  const domain = new URL(actorUri).hostname;
  return getContentOutboxPage(db, domain, page, pageSize, u.id);
}

/**
 * Page of the instance actor's outbox (all users' published+public content as Create activities).
 * This is what mirror backfill crawls.
 */
export async function getInstanceOutboxPage(
  db: DB,
  domain: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Record<string, unknown>[]> {
  return getContentOutboxPage(db, domain, page, pageSize);
}

/**
 * Count total outbox items for a hub Group actor.
 * Counts delivered outbound Announce activities from the hub actor.
 */
export async function countHubOutboxItems(db: DB, hubActorUri: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .where(
      and(
        eq(activities.actorUri, hubActorUri),
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'delivered'),
        eq(activities.type, 'Announce'),
      ),
    );
  return result?.count ?? 0;
}

/**
 * Get a page of outbox activities for a hub Group actor.
 * Returns Announce activity payloads.
 */
export async function getHubOutboxPage(
  db: DB,
  hubActorUri: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Record<string, unknown>[]> {
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select({ payload: activities.payload })
    .from(activities)
    .where(
      and(
        eq(activities.actorUri, hubActorUri),
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'delivered'),
        eq(activities.type, 'Announce'),
      ),
    )
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(pageSize)
    .offset(offset);

  return rows.map((r) => r.payload as Record<string, unknown>);
}
