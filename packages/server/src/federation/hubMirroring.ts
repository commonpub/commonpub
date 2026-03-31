import { eq, and, desc, isNull, sql, ilike } from 'drizzle-orm';
import {
  federatedHubs,
  federatedHubPosts,
  remoteActors,
  activities,
  followRelationships,
  instanceMirrors,
} from '@commonpub/schema';
import { buildFollowActivity } from '@commonpub/protocol';
import type {
  DB,
  FederatedHubListItem,
  FederatedHubPostItem,
  SharedContentMeta,
} from '../types.js';
import { normalizePagination, escapeLike } from '../query.js';

// --- Federated Hub CRUD ---

/**
 * List all federated hubs (accepted + not hidden).
 * Used by listHubs() when includeFederated is true.
 */
export async function listFederatedHubs(
  db: DB,
  filters: { search?: string; limit?: number; offset?: number } = {},
): Promise<{ items: FederatedHubListItem[]; total: number }> {
  const conditions = [
    eq(federatedHubs.status, 'accepted'),
    eq(federatedHubs.isHidden, false),
  ];

  if (filters.search) {
    conditions.push(ilike(federatedHubs.name, `%${escapeLike(filters.search)}%`));
  }

  const where = and(...conditions);
  const { limit, offset } = normalizePagination(filters);

  const [rows, countResult] = await Promise.all([
    db
      .select({ hub: federatedHubs, actorFollowers: remoteActors.followerCount })
      .from(federatedHubs)
      .leftJoin(remoteActors, eq(federatedHubs.remoteActorId, remoteActors.id))
      .where(where)
      .orderBy(desc(federatedHubs.receivedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(federatedHubs)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  const items: FederatedHubListItem[] = rows.map((row) => ({
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.remoteSlug,
    description: row.hub.description,
    hubType: row.hub.hubType,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    memberCount: Math.max(row.hub.remoteMemberCount, row.actorFollowers ?? 0),
    postCount: row.hub.localPostCount,
    originDomain: row.hub.originDomain,
    url: row.hub.url,
    actorUri: row.hub.actorUri,
    followStatus: row.hub.status as 'pending' | 'accepted' | 'rejected',
    receivedAt: row.hub.receivedAt,
    source: 'federated',
  }));

  return { items, total };
}

/**
 * Get a single federated hub by its local ID.
 */
export async function getFederatedHub(
  db: DB,
  hubId: string,
): Promise<FederatedHubListItem | null> {
  const [row] = await db
    .select({ hub: federatedHubs, actor: remoteActors })
    .from(federatedHubs)
    .leftJoin(remoteActors, eq(federatedHubs.remoteActorId, remoteActors.id))
    .where(and(
      eq(federatedHubs.id, hubId),
      eq(federatedHubs.isHidden, false),
    ))
    .limit(1);

  if (!row) return null;

  // Refresh metadata from cached actor if stale (> 1 hour)
  const actor = row.actor;
  let memberCount = row.hub.remoteMemberCount;
  if (actor) {
    const age = Date.now() - (actor.lastFetchedAt?.getTime() ?? 0);
    if (age > 60 * 60 * 1000) {
      // Background refresh — don't block the response
      refreshFederatedHubMetadata(db, row.hub.id, row.hub.actorUri).catch(() => {});
    }
    // Use the cached follower count if it's better than what we have
    if (actor.followerCount && actor.followerCount > memberCount) {
      memberCount = actor.followerCount;
    }
  }

  return {
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.remoteSlug,
    description: row.hub.description,
    hubType: row.hub.hubType,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    memberCount,
    postCount: row.hub.localPostCount,
    originDomain: row.hub.originDomain,
    url: row.hub.url,
    actorUri: row.hub.actorUri,
    followStatus: row.hub.status as 'pending' | 'accepted' | 'rejected',
    receivedAt: row.hub.receivedAt,
    source: 'federated',
  };
}

/**
 * Background refresh of federated hub metadata from the remote Group actor.
 * Fetches the actor to update name, description, icon, and follower count.
 */
async function refreshFederatedHubMetadata(
  db: DB,
  hubId: string,
  actorUri: string,
): Promise<void> {
  try {
    const { resolveRemoteActor } = await import('./federation.js');
    const actor = await resolveRemoteActor(db, actorUri);
    if (!actor) return;

    // Read the updated cache
    const [cached] = await db
      .select()
      .from(remoteActors)
      .where(eq(remoteActors.actorUri, actorUri))
      .limit(1);
    if (!cached) return;

    await db.update(federatedHubs).set({
      name: cached.displayName ?? cached.preferredUsername ?? undefined,
      description: cached.summary ?? undefined,
      iconUrl: cached.avatarUrl ?? undefined,
      bannerUrl: cached.bannerUrl ?? undefined,
      remoteMemberCount: cached.followerCount ?? undefined,
      updatedAt: new Date(),
    }).where(eq(federatedHubs.id, hubId));
  } catch {
    // Non-fatal background refresh
  }
}

/**
 * Get a federated hub by its AP actor URI.
 */
/**
 * Get a federated hub by its AP actor URI.
 * Only returns hubs with status='accepted' (follow handshake completed).
 */
export async function getFederatedHubByActorUri(
  db: DB,
  actorUri: string,
): Promise<FederatedHubListItem | null> {
  const [row] = await db
    .select({ hub: federatedHubs })
    .from(federatedHubs)
    .where(and(
      eq(federatedHubs.actorUri, actorUri),
      eq(federatedHubs.status, 'accepted'),
    ))
    .limit(1);

  if (!row) return null;

  return {
    id: row.hub.id,
    name: row.hub.name,
    slug: row.hub.remoteSlug,
    description: row.hub.description,
    hubType: row.hub.hubType,
    iconUrl: row.hub.iconUrl,
    bannerUrl: row.hub.bannerUrl,
    memberCount: row.hub.remoteMemberCount,
    postCount: row.hub.localPostCount,
    originDomain: row.hub.originDomain,
    url: row.hub.url,
    actorUri: row.hub.actorUri,
    followStatus: row.hub.status as 'pending' | 'accepted' | 'rejected',
    receivedAt: row.hub.receivedAt,
    source: 'federated',
  };
}

// --- Hub Follow (Mirror Creation) ---

/**
 * Follow a remote hub Group actor to start mirroring.
 * Returns the created federated hub entry.
 */
export async function followRemoteHub(
  db: DB,
  actorUri: string,
  metadata: {
    originDomain: string;
    remoteSlug: string;
    name: string;
    description?: string;
    iconUrl?: string;
    bannerUrl?: string;
    hubType?: string;
    remoteMemberCount?: number;
    remotePostCount?: number;
    url?: string;
    rules?: string;
    categories?: string[];
  },
  followActivityUri?: string,
): Promise<{ id: string; created: boolean }> {
  const metaFields = {
    name: metadata.name,
    description: metadata.description ?? null,
    iconUrl: metadata.iconUrl ?? null,
    bannerUrl: metadata.bannerUrl ?? null,
    hubType: metadata.hubType ?? 'community',
    remoteMemberCount: metadata.remoteMemberCount ?? 0,
    remotePostCount: metadata.remotePostCount ?? 0,
    url: metadata.url ?? null,
    rules: metadata.rules ?? null,
    categories: metadata.categories ?? null,
    followActivityUri: followActivityUri ?? null,
    updatedAt: new Date(),
  };

  // Try insert first — onConflictDoNothing to detect if it already existed
  const inserted = await db.insert(federatedHubs).values({
    actorUri,
    originDomain: metadata.originDomain,
    remoteSlug: metadata.remoteSlug,
    status: 'pending',
    ...metaFields,
  }).onConflictDoNothing({ target: federatedHubs.actorUri })
    .returning({ id: federatedHubs.id });

  if (inserted.length > 0) {
    return { id: inserted[0]!.id, created: true };
  }

  // Already existed — update metadata
  const [updated] = await db.update(federatedHubs).set(metaFields)
    .where(eq(federatedHubs.actorUri, actorUri))
    .returning({ id: federatedHubs.id });

  return { id: updated!.id, created: false };
}

/**
 * Accept a hub follow — called when we receive Accept(Follow) from the remote Group actor.
 */
export async function acceptHubFollow(
  db: DB,
  actorUri: string,
): Promise<boolean> {
  const result = await db
    .update(federatedHubs)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(and(
      eq(federatedHubs.actorUri, actorUri),
      eq(federatedHubs.status, 'pending'),
    ))
    .returning({ id: federatedHubs.id });

  return result.length > 0;
}

/**
 * Unfollow/cancel a hub mirror.
 */
export async function unfollowRemoteHub(
  db: DB,
  actorUri: string,
): Promise<boolean> {
  const result = await db
    .update(federatedHubs)
    .set({ isHidden: true, status: 'rejected', updatedAt: new Date() })
    .where(eq(federatedHubs.actorUri, actorUri))
    .returning({ id: federatedHubs.id });

  return result.length > 0;
}

/**
 * Auto-discover a hub from a Group actor URI when it belongs to a mirrored instance.
 * Checks instanceMirrors for an active pull mirror on the Group's domain.
 * If found, creates a federatedHubs entry with status='accepted' (auto-accepted
 * because we trust the instance mirror relationship).
 *
 * Returns the federated hub ID if auto-discovered, null otherwise.
 */
export async function autoDiscoverHub(
  db: DB,
  groupActorUri: string,
): Promise<string | null> {
  let groupDomain: string;
  try {
    groupDomain = new URL(groupActorUri).hostname;
  } catch {
    return null;
  }

  // Check if this domain has an active pull mirror
  const [mirror] = await db
    .select({ id: instanceMirrors.id })
    .from(instanceMirrors)
    .where(
      and(
        eq(instanceMirrors.remoteDomain, groupDomain),
        eq(instanceMirrors.status, 'active'),
        eq(instanceMirrors.direction, 'pull'),
      ),
    )
    .limit(1);

  if (!mirror) return null;

  // Resolve the Group actor to get metadata
  let [cachedActor] = await db
    .select()
    .from(remoteActors)
    .where(eq(remoteActors.actorUri, groupActorUri))
    .limit(1);

  // If cached as 'Person' but URI matches hub pattern, force re-resolve
  // (pre-2.4.4 bug: actorType was never stored, defaulted to 'Person')
  if (cachedActor && cachedActor.actorType === 'Person' && groupActorUri.includes('/hubs/')) {
    try {
      const { resolveRemoteActor } = await import('./federation.js');
      await resolveRemoteActor(db, groupActorUri);
      [cachedActor] = await db
        .select()
        .from(remoteActors)
        .where(eq(remoteActors.actorUri, groupActorUri))
        .limit(1);
    } catch { /* keep stale cache */ }
  }

  if (!cachedActor || cachedActor.actorType !== 'Group') return null;

  // Extract slug from URI pattern: https://domain/hubs/slug
  const slugMatch = groupActorUri.match(/\/hubs\/([^/]+)$/);
  const remoteSlug = slugMatch?.[1] ?? cachedActor.preferredUsername ?? 'unknown';

  // Auto-create as accepted (trusted via instance mirror)
  const inserted = await db.insert(federatedHubs).values({
    actorUri: groupActorUri,
    remoteActorId: cachedActor.id,
    originDomain: groupDomain,
    remoteSlug,
    name: cachedActor.displayName ?? cachedActor.preferredUsername ?? remoteSlug,
    description: cachedActor.summary ?? null,
    iconUrl: cachedActor.avatarUrl ?? null,
    bannerUrl: cachedActor.bannerUrl ?? null,
    hubType: 'community',
    remoteMemberCount: cachedActor.followerCount ?? 0,
    status: 'accepted',
    url: `https://${groupDomain}/hubs/${remoteSlug}`,
  }).onConflictDoNothing({ target: federatedHubs.actorUri })
    .returning({ id: federatedHubs.id });

  if (inserted.length > 0) {
    return inserted[0]!.id;
  }

  // Already existed — return existing (may have been hidden by admin)
  const [existing] = await db
    .select({ id: federatedHubs.id, isHidden: federatedHubs.isHidden })
    .from(federatedHubs)
    .where(eq(federatedHubs.actorUri, groupActorUri))
    .limit(1);

  // Don't override admin's decision to hide
  if (existing?.isHidden) return null;

  return existing?.id ?? null;
}

/**
 * Queue an outbound Follow activity from the local instance actor to a remote Group actor.
 * This is the AP handshake that initiates hub mirroring.
 */
export async function sendHubFollow(
  db: DB,
  remoteGroupActorUri: string,
  domain: string,
): Promise<void> {
  // Resolve & cache remote actor (delivery worker needs their inbox)
  const { resolveRemoteActor } = await import('./federation.js');
  const resolved = await resolveRemoteActor(db, remoteGroupActorUri).catch(() => null);
  if (!resolved) {
    throw new Error(`Could not resolve remote hub actor ${remoteGroupActorUri}`);
  }

  const localActorUri = `https://${domain}/actor`;
  const followActivity = buildFollowActivity(domain, localActorUri, remoteGroupActorUri);

  // Store follow relationship for the delivery system to find
  await db.insert(followRelationships).values({
    followerActorUri: localActorUri,
    followingActorUri: remoteGroupActorUri,
    status: 'pending',
  }).onConflictDoNothing();

  // Update the federatedHubs record with the Follow activity URI
  await db.update(federatedHubs).set({
    followActivityUri: followActivity.id,
    updatedAt: new Date(),
  }).where(eq(federatedHubs.actorUri, remoteGroupActorUri));

  // Queue Follow for async delivery
  await db.insert(activities).values({
    type: 'Follow',
    actorUri: localActorUri,
    objectUri: remoteGroupActorUri,
    payload: followActivity,
    direction: 'outbound',
    status: 'pending',
  });
}

// --- Federated Hub Posts ---

/**
 * Ingest a post from a federated hub (received via Announce from Group actor).
 */
export async function ingestFederatedHubPost(
  db: DB,
  federatedHubId: string,
  post: {
    objectUri: string;
    actorUri: string;
    content: string;
    postType?: string;
    isPinned?: boolean;
    remoteLikeCount?: number;
    remoteReplyCount?: number;
    publishedAt?: Date;
    sharedContentMeta?: SharedContentMeta | null;
  },
): Promise<{ id: string; created: boolean }> {
  // Resolve remote actor
  const [actor] = await db
    .select({ id: remoteActors.id })
    .from(remoteActors)
    .where(eq(remoteActors.actorUri, post.actorUri))
    .limit(1);

  // Try insert first — if conflict (already exists), update separately
  const inserted = await db.insert(federatedHubPosts).values({
    federatedHubId,
    objectUri: post.objectUri,
    actorUri: post.actorUri,
    remoteActorId: actor?.id ?? null,
    content: post.content,
    postType: post.postType ?? 'text',
    isPinned: post.isPinned ?? false,
    remoteLikeCount: post.remoteLikeCount ?? 0,
    remoteReplyCount: post.remoteReplyCount ?? 0,
    publishedAt: post.publishedAt ?? null,
    sharedContentMeta: post.sharedContentMeta ?? null,
  }).onConflictDoNothing({ target: federatedHubPosts.objectUri })
    .returning({ id: federatedHubPosts.id });

  if (inserted.length > 0) {
    // Genuinely new post — increment count
    await db.update(federatedHubs).set({
      localPostCount: sql`${federatedHubs.localPostCount} + 1`,
      lastSyncAt: new Date(),
    }).where(eq(federatedHubs.id, federatedHubId));

    return { id: inserted[0]!.id, created: true };
  }

  // Already existed — update content
  const [existing] = await db.update(federatedHubPosts).set({
    content: post.content,
    postType: post.postType ?? 'text',
    isPinned: post.isPinned ?? false,
    remoteLikeCount: post.remoteLikeCount ?? 0,
    remoteReplyCount: post.remoteReplyCount ?? 0,
    sharedContentMeta: post.sharedContentMeta ?? null,
  }).where(eq(federatedHubPosts.objectUri, post.objectUri))
    .returning({ id: federatedHubPosts.id });

  return { id: existing!.id, created: false };
}

/**
 * Get a single federated hub post by ID.
 */
export async function getFederatedHubPost(
  db: DB,
  postId: string,
): Promise<FederatedHubPostItem | null> {
  const rows = await db
    .select({
      post: federatedHubPosts,
      actor: {
        actorUri: remoteActors.actorUri,
        preferredUsername: remoteActors.preferredUsername,
        displayName: remoteActors.displayName,
        avatarUrl: remoteActors.avatarUrl,
        instanceDomain: remoteActors.instanceDomain,
      },
    })
    .from(federatedHubPosts)
    .leftJoin(remoteActors, eq(federatedHubPosts.remoteActorId, remoteActors.id))
    .where(and(eq(federatedHubPosts.id, postId), isNull(federatedHubPosts.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.post.id,
    federatedHubId: row.post.federatedHubId,
    content: row.post.content,
    postType: row.post.postType,
    isPinned: row.post.isPinned,
    localLikeCount: row.post.localLikeCount,
    localReplyCount: row.post.localReplyCount,
    remoteLikeCount: row.post.remoteLikeCount,
    remoteReplyCount: row.post.remoteReplyCount,
    publishedAt: row.post.publishedAt,
    receivedAt: row.post.receivedAt,
    objectUri: row.post.objectUri,
    sharedContentMeta: (row.post.sharedContentMeta as SharedContentMeta) ?? null,
    author: {
      actorUri: row.actor?.actorUri ?? row.post.actorUri,
      preferredUsername: row.actor?.preferredUsername ?? null,
      displayName: row.actor?.displayName ?? null,
      avatarUrl: row.actor?.avatarUrl ?? null,
      instanceDomain: row.actor?.instanceDomain ?? 'unknown',
    },
    source: 'federated',
  };
}

/**
 * List posts for a federated hub.
 */
export async function listFederatedHubPosts(
  db: DB,
  federatedHubId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: FederatedHubPostItem[]; total: number }> {
  const { limit, offset } = normalizePagination(opts);
  const where = and(
    eq(federatedHubPosts.federatedHubId, federatedHubId),
    isNull(federatedHubPosts.deletedAt),
  );

  const [rows, countResult] = await Promise.all([
    db
      .select({
        post: federatedHubPosts,
        actor: {
          actorUri: remoteActors.actorUri,
          preferredUsername: remoteActors.preferredUsername,
          displayName: remoteActors.displayName,
          avatarUrl: remoteActors.avatarUrl,
          instanceDomain: remoteActors.instanceDomain,
        },
      })
      .from(federatedHubPosts)
      .leftJoin(remoteActors, eq(federatedHubPosts.remoteActorId, remoteActors.id))
      .where(where)
      .orderBy(desc(federatedHubPosts.isPinned), desc(federatedHubPosts.receivedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(federatedHubPosts)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  const items: FederatedHubPostItem[] = rows.map((row) => ({
    id: row.post.id,
    federatedHubId: row.post.federatedHubId,
    content: row.post.content,
    postType: row.post.postType,
    isPinned: row.post.isPinned,
    localLikeCount: row.post.localLikeCount,
    localReplyCount: row.post.localReplyCount,
    remoteLikeCount: row.post.remoteLikeCount,
    remoteReplyCount: row.post.remoteReplyCount,
    publishedAt: row.post.publishedAt,
    receivedAt: row.post.receivedAt,
    objectUri: row.post.objectUri,
    sharedContentMeta: (row.post.sharedContentMeta as SharedContentMeta) ?? null,
    author: {
      actorUri: row.actor?.actorUri ?? row.post.actorUri,
      preferredUsername: row.actor?.preferredUsername ?? null,
      displayName: row.actor?.displayName ?? null,
      avatarUrl: row.actor?.avatarUrl ?? null,
      instanceDomain: row.actor?.instanceDomain ?? 'unknown',
    },
    source: 'federated',
  }));

  return { items, total };
}

/**
 * Delete a federated hub post (on receiving Delete activity).
 * Validates actorUri matches the post author for defense in depth.
 */
export async function deleteFederatedHubPost(
  db: DB,
  objectUri: string,
  actorUri?: string,
): Promise<boolean> {
  const conditions = [
    eq(federatedHubPosts.objectUri, objectUri),
    isNull(federatedHubPosts.deletedAt),
  ];
  if (actorUri) {
    conditions.push(eq(federatedHubPosts.actorUri, actorUri));
  }
  const result = await db
    .update(federatedHubPosts)
    .set({ deletedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: federatedHubPosts.id, federatedHubId: federatedHubPosts.federatedHubId });

  if (result.length === 0) return false;

  // Decrement local post count
  await db.update(federatedHubs).set({
    localPostCount: sql`GREATEST(${federatedHubs.localPostCount} - 1, 0)`,
  }).where(eq(federatedHubs.id, result[0]!.federatedHubId));

  return true;
}

/**
 * Like a federated hub post (increment local counter).
 * The caller is responsible for queuing the outbound Like activity.
 */
export async function likeFederatedHubPost(
  db: DB,
  postId: string,
): Promise<boolean> {
  const result = await db
    .update(federatedHubPosts)
    .set({ localLikeCount: sql`${federatedHubPosts.localLikeCount} + 1` })
    .where(eq(federatedHubPosts.id, postId))
    .returning({ id: federatedHubPosts.id });

  return result.length > 0;
}

/**
 * Unlike a federated hub post (decrement local counter).
 */
export async function unlikeFederatedHubPost(
  db: DB,
  postId: string,
): Promise<boolean> {
  const result = await db
    .update(federatedHubPosts)
    .set({ localLikeCount: sql`GREATEST(${federatedHubPosts.localLikeCount} - 1, 0)` })
    .where(eq(federatedHubPosts.id, postId))
    .returning({ id: federatedHubPosts.id });

  return result.length > 0;
}
