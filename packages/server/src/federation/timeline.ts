/**
 * Federated timeline queries and remote content interaction functions.
 * Queries the federatedContent table populated by inbound Create activities.
 */
import { eq, and, desc, sql, isNull, ilike, or } from 'drizzle-orm';
import {
  federatedContent,
  remoteActors,
  activities,
  users,
} from '@commonpub/schema';
import { buildLikeActivity, buildAnnounceActivity, buildCreateActivity, contentToNote } from '@commonpub/protocol';
import type { DB } from '../types.js';

/** A federated content item with resolved actor info */
export interface FederatedContentItem {
  id: string;
  objectUri: string;
  apType: string;
  title: string | null;
  content: string | null;
  summary: string | null;
  url: string | null;
  coverImageUrl: string | null;
  tags: Array<{ type: string; name: string }>;
  attachments: Array<{ type: string; url: string; name?: string }>;
  inReplyTo: string | null;
  cpubType: string | null;
  cpubMetadata: Record<string, unknown> | null;
  /** Original block tuples from CommonPub instances (null for non-CommonPub content) */
  cpubBlocks: unknown[] | null;
  localLikeCount: number;
  localCommentCount: number;
  publishedAt: string | null;
  receivedAt: string;
  originDomain: string;
  actor: {
    actorUri: string;
    preferredUsername: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    instanceDomain: string;
  } | null;
}

export interface FederatedTimelineOptions {
  limit?: number;
  offset?: number;
  /** Filter by AP type: 'Article', 'Note', etc. */
  apType?: string;
  /** Filter by CommonPub type: 'project', 'blog', etc. */
  cpubType?: string;
  /** Filter by origin domain */
  originDomain?: string;
}

/**
 * List federated content for the timeline.
 * Returns content received from followed remote actors, excluding deleted items.
 */
export async function listFederatedTimeline(
  db: DB,
  opts: FederatedTimelineOptions = {},
): Promise<{ items: FederatedContentItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  // Build where conditions
  const conditions = [isNull(federatedContent.deletedAt), eq(federatedContent.isHidden, false)];
  if (opts.apType) conditions.push(eq(federatedContent.apType, opts.apType));
  if (opts.cpubType) conditions.push(eq(federatedContent.cpubType, opts.cpubType));
  if (opts.originDomain) conditions.push(eq(federatedContent.originDomain, opts.originDomain));

  const where = conditions.length === 1 ? conditions[0]! : and(...conditions);

  // Count total
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(federatedContent)
    .where(where);
  const total = countRow?.count ?? 0;

  // Fetch items with actor join
  const rows = await db
    .select({
      content: federatedContent,
      actor: {
        actorUri: remoteActors.actorUri,
        preferredUsername: remoteActors.preferredUsername,
        displayName: remoteActors.displayName,
        avatarUrl: remoteActors.avatarUrl,
        instanceDomain: remoteActors.instanceDomain,
      },
    })
    .from(federatedContent)
    .leftJoin(remoteActors, eq(federatedContent.remoteActorId, remoteActors.id))
    .where(where)
    .orderBy(desc(federatedContent.receivedAt))
    .limit(limit)
    .offset(offset);

  const items: FederatedContentItem[] = rows.map((r) => ({
    id: r.content.id,
    objectUri: r.content.objectUri,
    apType: r.content.apType,
    title: r.content.title,
    content: r.content.content,
    summary: r.content.summary,
    url: r.content.url,
    coverImageUrl: r.content.coverImageUrl,
    tags: (r.content.tags ?? []) as Array<{ type: string; name: string }>,
    attachments: (r.content.attachments ?? []) as Array<{ type: string; url: string; name?: string }>,
    inReplyTo: r.content.inReplyTo,
    cpubType: r.content.cpubType,
    cpubMetadata: (r.content.cpubMetadata ?? null) as Record<string, unknown> | null,
    cpubBlocks: (r.content.cpubBlocks ?? null) as unknown[] | null,
    localLikeCount: r.content.localLikeCount,
    localCommentCount: r.content.localCommentCount,
    publishedAt: r.content.publishedAt?.toISOString() ?? null,
    receivedAt: r.content.receivedAt.toISOString(),
    originDomain: r.content.originDomain,
    actor: r.actor?.actorUri ? {
      actorUri: r.actor.actorUri,
      preferredUsername: r.actor.preferredUsername,
      displayName: r.actor.displayName,
      avatarUrl: r.actor.avatarUrl,
      instanceDomain: r.actor.instanceDomain,
    } : null,
  }));

  return { items, total };
}

/**
 * Get a single federated content item by ID.
 */
export async function getFederatedContent(
  db: DB,
  id: string,
): Promise<FederatedContentItem | null> {
  const rows = await db
    .select({
      content: federatedContent,
      actor: {
        actorUri: remoteActors.actorUri,
        preferredUsername: remoteActors.preferredUsername,
        displayName: remoteActors.displayName,
        avatarUrl: remoteActors.avatarUrl,
        instanceDomain: remoteActors.instanceDomain,
      },
    })
    .from(federatedContent)
    .leftJoin(remoteActors, eq(federatedContent.remoteActorId, remoteActors.id))
    .where(and(eq(federatedContent.id, id), isNull(federatedContent.deletedAt), eq(federatedContent.isHidden, false)))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0]!;
  return {
    id: r.content.id,
    objectUri: r.content.objectUri,
    apType: r.content.apType,
    title: r.content.title,
    content: r.content.content,
    summary: r.content.summary,
    url: r.content.url,
    coverImageUrl: r.content.coverImageUrl,
    tags: (r.content.tags ?? []) as Array<{ type: string; name: string }>,
    attachments: (r.content.attachments ?? []) as Array<{ type: string; url: string; name?: string }>,
    inReplyTo: r.content.inReplyTo,
    cpubType: r.content.cpubType,
    cpubMetadata: (r.content.cpubMetadata ?? null) as Record<string, unknown> | null,
    cpubBlocks: (r.content.cpubBlocks ?? null) as unknown[] | null,
    localLikeCount: r.content.localLikeCount,
    localCommentCount: r.content.localCommentCount,
    publishedAt: r.content.publishedAt?.toISOString() ?? null,
    receivedAt: r.content.receivedAt.toISOString(),
    originDomain: r.content.originDomain,
    actor: r.actor?.actorUri ? {
      actorUri: r.actor.actorUri,
      preferredUsername: r.actor.preferredUsername,
      displayName: r.actor.displayName,
      avatarUrl: r.actor.avatarUrl,
      instanceDomain: r.actor.instanceDomain,
    } : null,
  };
}

/**
 * Like remote federated content. Creates a local engagement record
 * and queues an outbound Like activity to the content's origin instance.
 * Idempotent: calling twice for the same user+content is a no-op.
 */
export async function likeRemoteContent(
  db: DB,
  userId: string,
  federatedContentId: string,
  domain: string,
): Promise<boolean> {
  // Get the federated content and user
  const [content] = await db
    .select()
    .from(federatedContent)
    .where(eq(federatedContent.id, federatedContentId))
    .limit(1);
  if (!content) return false;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;

  const actorUri = `https://${domain}/users/${user.username}`;

  // Dedup: check if this user already liked this content (via outbound Like activity)
  const existingLike = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.type, 'Like'),
        eq(activities.actorUri, actorUri),
        eq(activities.objectUri, content.objectUri),
        eq(activities.direction, 'outbound'),
      ),
    )
    .limit(1);

  if (existingLike.length > 0) {
    return true; // Already liked — idempotent success
  }

  // Increment local like count
  await db
    .update(federatedContent)
    .set({ localLikeCount: sql`${federatedContent.localLikeCount} + 1` })
    .where(eq(federatedContent.id, federatedContentId));

  // Queue outbound Like activity
  const activity = buildLikeActivity(domain, actorUri, content.objectUri);

  await db.insert(activities).values({
    type: 'Like',
    actorUri,
    objectUri: content.objectUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });

  return true;
}

/**
 * Boost/share remote federated content. Queues an outbound Announce activity.
 */
export async function boostRemoteContent(
  db: DB,
  userId: string,
  federatedContentId: string,
  domain: string,
): Promise<boolean> {
  const [content] = await db
    .select()
    .from(federatedContent)
    .where(eq(federatedContent.id, federatedContentId))
    .limit(1);
  if (!content) return false;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;

  const actorUri = `https://${domain}/users/${user.username}`;
  const followersUri = `${actorUri}/followers`;
  const activity = buildAnnounceActivity(domain, actorUri, content.objectUri, followersUri);

  await db.insert(activities).values({
    type: 'Announce',
    actorUri,
    objectUri: content.objectUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });

  return true;
}

/**
 * Reply to remote federated content. Creates an outbound Create(Note) activity
 * with inReplyTo pointing to the remote content's objectUri.
 */
export async function federateReply(
  db: DB,
  userId: string,
  federatedContentId: string,
  replyContent: string,
  domain: string,
): Promise<boolean> {
  const [content] = await db
    .select()
    .from(federatedContent)
    .where(eq(federatedContent.id, federatedContentId))
    .limit(1);
  if (!content) return false;

  // Validate objectUri before using as inReplyTo
  try { new URL(content.objectUri); } catch { return false; }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;

  const actorUri = `https://${domain}/users/${user.username}`;
  const note = contentToNote(
    {
      id: crypto.randomUUID(),
      content: replyContent,
      targetId: content.objectUri,
      targetType: 'content',
    },
    { username: user.username, displayName: user.displayName },
    domain,
    content.objectUri,
  );

  const createActivity = buildCreateActivity(domain, actorUri, note);

  await db.insert(activities).values({
    type: 'Create',
    actorUri,
    objectUri: note.id,
    payload: createActivity,
    direction: 'outbound',
    status: 'pending',
  });

  return true;
}

/**
 * List remote replies (federated content with inReplyTo matching a given URI).
 */
export async function listRemoteReplies(
  db: DB,
  parentObjectUri: string,
): Promise<FederatedContentItem[]> {
  const rows = await db
    .select({
      content: federatedContent,
      actor: {
        actorUri: remoteActors.actorUri,
        preferredUsername: remoteActors.preferredUsername,
        displayName: remoteActors.displayName,
        avatarUrl: remoteActors.avatarUrl,
        instanceDomain: remoteActors.instanceDomain,
      },
    })
    .from(federatedContent)
    .leftJoin(remoteActors, eq(federatedContent.remoteActorId, remoteActors.id))
    .where(
      and(
        eq(federatedContent.inReplyTo, parentObjectUri),
        isNull(federatedContent.deletedAt),
        eq(federatedContent.isHidden, false),
      ),
    )
    .orderBy(federatedContent.receivedAt);

  return rows.map((r) => ({
    id: r.content.id,
    objectUri: r.content.objectUri,
    apType: r.content.apType,
    title: r.content.title,
    content: r.content.content,
    summary: r.content.summary,
    url: r.content.url,
    coverImageUrl: r.content.coverImageUrl,
    tags: (r.content.tags ?? []) as Array<{ type: string; name: string }>,
    attachments: (r.content.attachments ?? []) as Array<{ type: string; url: string; name?: string }>,
    inReplyTo: r.content.inReplyTo,
    cpubType: r.content.cpubType,
    cpubMetadata: (r.content.cpubMetadata ?? null) as Record<string, unknown> | null,
    cpubBlocks: (r.content.cpubBlocks ?? null) as unknown[] | null,
    localLikeCount: r.content.localLikeCount,
    localCommentCount: r.content.localCommentCount,
    publishedAt: r.content.publishedAt?.toISOString() ?? null,
    receivedAt: r.content.receivedAt.toISOString(),
    originDomain: r.content.originDomain,
    actor: r.actor?.actorUri ? {
      actorUri: r.actor.actorUri,
      preferredUsername: r.actor.preferredUsername,
      displayName: r.actor.displayName,
      avatarUrl: r.actor.avatarUrl,
      instanceDomain: r.actor.instanceDomain,
    } : null,
  }));
}

/**
 * Search federated content by text query.
 * Uses PostgreSQL full-text search (to_tsvector/websearch_to_tsquery) for fuzzy matching and ranking.
 * Falls back to ILIKE for single-character or operator-only queries that FTS can't handle.
 */
export async function searchFederatedContent(
  db: DB,
  query: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: FederatedContentItem[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  // Use FTS when query is substantive enough, fall back to ILIKE for short/special queries
  const useFts = query.trim().length > 1;
  const ftsCondition = useFts
    ? sql`to_tsvector('english', coalesce(${federatedContent.title}, '') || ' ' || coalesce(${federatedContent.summary}, '') || ' ' || coalesce(${federatedContent.content}, '')) @@ websearch_to_tsquery('english', ${query})`
    : or(
        ilike(federatedContent.title, `%${query}%`),
        ilike(federatedContent.content, `%${query}%`),
        ilike(federatedContent.summary, `%${query}%`),
      );

  const where = and(
    isNull(federatedContent.deletedAt),
    eq(federatedContent.isHidden, false),
    ftsCondition,
  );

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(federatedContent)
    .where(where);
  const total = countRow?.count ?? 0;

  const rows = await db
    .select({
      content: federatedContent,
      actor: {
        actorUri: remoteActors.actorUri,
        preferredUsername: remoteActors.preferredUsername,
        displayName: remoteActors.displayName,
        avatarUrl: remoteActors.avatarUrl,
        instanceDomain: remoteActors.instanceDomain,
      },
    })
    .from(federatedContent)
    .leftJoin(remoteActors, eq(federatedContent.remoteActorId, remoteActors.id))
    .where(where)
    .orderBy(desc(federatedContent.receivedAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map((r) => ({
      id: r.content.id,
      objectUri: r.content.objectUri,
      apType: r.content.apType,
      title: r.content.title,
      content: r.content.content,
      summary: r.content.summary,
      url: r.content.url,
      coverImageUrl: r.content.coverImageUrl,
      tags: (r.content.tags ?? []) as Array<{ type: string; name: string }>,
      attachments: (r.content.attachments ?? []) as Array<{ type: string; url: string; name?: string }>,
      inReplyTo: r.content.inReplyTo,
      cpubType: r.content.cpubType,
      cpubMetadata: (r.content.cpubMetadata ?? null) as Record<string, unknown> | null,
      cpubBlocks: (r.content.cpubBlocks ?? null) as unknown[] | null,
      localLikeCount: r.content.localLikeCount,
      localCommentCount: r.content.localCommentCount,
      publishedAt: r.content.publishedAt?.toISOString() ?? null,
      receivedAt: r.content.receivedAt.toISOString(),
      originDomain: r.content.originDomain,
      actor: r.actor?.actorUri ? {
        actorUri: r.actor.actorUri,
        preferredUsername: r.actor.preferredUsername,
        displayName: r.actor.displayName,
        avatarUrl: r.actor.avatarUrl,
        instanceDomain: r.actor.instanceDomain,
      } : null,
    })),
    total,
  };
}
