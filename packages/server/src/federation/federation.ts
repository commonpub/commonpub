import { eq, and, desc, sql } from 'drizzle-orm';
import {
  users,
  remoteActors,
  activities,
  followRelationships,
  actorKeypairs,
  contentItems,
  contentTags,
  tags,
  instanceSettings,
} from '@commonpub/schema';
import {
  generateKeypair,
  exportPublicKeyPem,
  exportPrivateKeyPem,
  resolveActor,
  resolveActorViaWebFinger,
  contentToArticle,
  buildCreateActivity,
  buildUpdateActivity,
  buildDeleteActivity,
  buildFollowActivity,
  buildAcceptActivity,
  buildRejectActivity,
  buildUndoActivity,
  buildLikeActivity,
  type ResolvedActor,
} from '@commonpub/protocol';
import type { DB } from '../types.js';

// --- Keypair Management ---

export async function getOrCreateActorKeypair(
  db: DB,
  userId: string,
): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
  const existing = await db
    .select()
    .from(actorKeypairs)
    .where(eq(actorKeypairs.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return {
      publicKeyPem: existing[0]!.publicKeyPem,
      privateKeyPem: existing[0]!.privateKeyPem,
    };
  }

  const keypair = await generateKeypair();
  const publicKeyPem = await exportPublicKeyPem(keypair);
  const privateKeyPem = await exportPrivateKeyPem(keypair);

  await db.insert(actorKeypairs).values({
    userId,
    publicKeyPem,
    privateKeyPem,
  });

  return { publicKeyPem, privateKeyPem };
}

const INSTANCE_KEYPAIR_KEY = 'instance_keypair';

/**
 * Get or create the instance-level keypair (for the Service actor at /actor).
 * Stored in instanceSettings since actorKeypairs requires a userId FK.
 */
export async function getOrCreateInstanceKeypair(
  db: DB,
): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
  const existing = await db
    .select()
    .from(instanceSettings)
    .where(eq(instanceSettings.key, INSTANCE_KEYPAIR_KEY))
    .limit(1);

  if (existing.length > 0) {
    const val = existing[0]!.value as { publicKeyPem: string; privateKeyPem: string };
    return val;
  }

  const keypair = await generateKeypair();
  const publicKeyPem = await exportPublicKeyPem(keypair);
  const privateKeyPem = await exportPrivateKeyPem(keypair);

  await db.insert(instanceSettings).values({
    key: INSTANCE_KEYPAIR_KEY,
    value: { publicKeyPem, privateKeyPem },
  });

  return { publicKeyPem, privateKeyPem };
}

/**
 * Build the instance actor AP object (Service type).
 */
export function buildInstanceActor(
  domain: string,
  publicKeyPem: string,
): Record<string, unknown> {
  const actorUri = `https://${domain}/actor`;
  return {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    type: 'Service',
    id: actorUri,
    preferredUsername: domain,
    name: domain,
    inbox: `https://${domain}/inbox`,
    outbox: `${actorUri}/outbox`,
    followers: `${actorUri}/followers`,
    following: `${actorUri}/following`,
    endpoints: {
      sharedInbox: `https://${domain}/inbox`,
    },
    publicKey: {
      id: `${actorUri}#main-key`,
      owner: actorUri,
      publicKeyPem,
    },
  };
}

// --- Actor Resolution ---

export async function resolveRemoteActor(db: DB, actorUri: string): Promise<ResolvedActor | null> {
  // Check cache first
  const cached = await db
    .select()
    .from(remoteActors)
    .where(eq(remoteActors.actorUri, actorUri))
    .limit(1);

  if (cached.length > 0) {
    const c = cached[0]!;
    // Re-fetch if older than 24 hours
    const age = Date.now() - c.lastFetchedAt.getTime();
    if (age < 24 * 60 * 60 * 1000) {
      return {
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Person',
        id: c.actorUri,
        inbox: c.inbox,
        outbox: c.outbox ?? undefined,
        preferredUsername: c.preferredUsername ?? undefined,
        name: c.displayName ?? undefined,
        summary: c.summary ?? undefined,
        publicKey: c.publicKeyPem
          ? { id: `${c.actorUri}#main-key`, owner: c.actorUri, publicKeyPem: c.publicKeyPem }
          : undefined,
        endpoints: c.sharedInbox ? { sharedInbox: c.sharedInbox } : undefined,
      };
    }
  }

  // Fetch from remote
  const actor = await resolveActor(actorUri, fetch);
  if (!actor) return null;

  // Extract domain
  const url = new URL(actorUri);
  const instanceDomain = url.hostname;

  // Upsert cache — include all fields the protocol returns
  const actorData = {
    inbox: actor.inbox,
    outbox: actor.outbox,
    sharedInbox: actor.endpoints?.sharedInbox,
    publicKeyPem: actor.publicKey?.publicKeyPem,
    preferredUsername: actor.preferredUsername,
    displayName: actor.name,
    summary: actor.summary,
    avatarUrl: actor.icon?.url,
    lastFetchedAt: new Date(),
  };

  if (cached.length > 0) {
    await db
      .update(remoteActors)
      .set(actorData)
      .where(eq(remoteActors.actorUri, actorUri));
  } else {
    await db.insert(remoteActors).values({
      actorUri,
      ...actorData,
      instanceDomain,
    });
  }

  return actor;
}

/** Remote actor profile returned by search */
export interface RemoteActorProfile {
  actorUri: string;
  inbox: string;
  preferredUsername: string | null;
  displayName: string | null;
  summary: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  instanceDomain: string;
  followerCount: number | null;
  followingCount: number | null;
  /** Whether the current user is following this actor */
  isFollowing?: boolean;
  /** Whether a follow is pending */
  isFollowPending?: boolean;
}

/**
 * Search for a remote actor by handle (`@user@domain` or `user@domain`).
 * Does WebFinger discovery, caches the result, and returns a profile.
 */
export async function searchRemoteActor(
  db: DB,
  query: string,
  localDomain: string,
  localUserId?: string,
): Promise<RemoteActorProfile | null> {
  // Parse @user@domain or user@domain
  const cleaned = query.replace(/^@/, '');
  const atIndex = cleaned.indexOf('@');
  if (atIndex === -1) return null;

  const username = cleaned.slice(0, atIndex);
  const domain = cleaned.slice(atIndex + 1);

  if (!username || !domain) return null;

  // Don't look up local users via federation
  if (domain === localDomain) return null;

  // WebFinger resolution — returns null on any network/DNS/parse error
  let actor: Awaited<ReturnType<typeof resolveActorViaWebFinger>>;
  try {
    actor = await resolveActorViaWebFinger(username, domain, fetch);
  } catch {
    return null;
  }
  if (!actor) return null;

  // Cache the resolved actor
  const instanceDomain = domain;
  const existing = await db
    .select()
    .from(remoteActors)
    .where(eq(remoteActors.actorUri, actor.id))
    .limit(1);

  const actorData = {
    inbox: actor.inbox,
    outbox: actor.outbox,
    sharedInbox: actor.endpoints?.sharedInbox,
    publicKeyPem: actor.publicKey?.publicKeyPem,
    preferredUsername: actor.preferredUsername,
    displayName: actor.name,
    summary: actor.summary,
    avatarUrl: actor.icon?.url,
    lastFetchedAt: new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(remoteActors)
      .set(actorData)
      .where(eq(remoteActors.actorUri, actor.id));
  } else {
    await db.insert(remoteActors).values({
      actorUri: actor.id,
      ...actorData,
      instanceDomain,
    });
  }

  // Re-read to get the canonical DB row with correct null types
  const [dbRow] = await db
    .select()
    .from(remoteActors)
    .where(eq(remoteActors.actorUri, actor.id))
    .limit(1);
  if (!dbRow) return null;

  // Check follow status if local user is specified
  let isFollowing = false;
  let isFollowPending = false;
  if (localUserId) {
    const localUser = await db.select().from(users).where(eq(users.id, localUserId)).limit(1);
    if (localUser[0]) {
      const localActorUri = `https://${localDomain}/users/${localUser[0].username}`;
      const followRel = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, localActorUri),
            eq(followRelationships.followingActorUri, actor.id),
          ),
        )
        .limit(1);
      if (followRel.length > 0) {
        isFollowing = followRel[0]!.status === 'accepted';
        isFollowPending = followRel[0]!.status === 'pending';
      }
    }
  }

  return {
    actorUri: actor.id,
    inbox: actor.inbox,
    preferredUsername: dbRow.preferredUsername,
    displayName: dbRow.displayName,
    summary: dbRow.summary,
    avatarUrl: dbRow.avatarUrl,
    bannerUrl: dbRow.bannerUrl,
    instanceDomain,
    followerCount: dbRow.followerCount,
    followingCount: dbRow.followingCount,
    isFollowing,
    isFollowPending,
  };
}

/** Get a cached remote actor profile from the database */
export async function getRemoteActorProfile(
  db: DB,
  actorUri: string,
  localDomain?: string,
  localUserId?: string,
): Promise<RemoteActorProfile | null> {
  const rows = await db
    .select()
    .from(remoteActors)
    .where(eq(remoteActors.actorUri, actorUri))
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0]!;

  let isFollowing = false;
  let isFollowPending = false;
  if (localUserId && localDomain) {
    const localUser = await db.select().from(users).where(eq(users.id, localUserId)).limit(1);
    if (localUser[0]) {
      const localActorUri = `https://${localDomain}/users/${localUser[0].username}`;
      const followRel = await db
        .select()
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, localActorUri),
            eq(followRelationships.followingActorUri, actorUri),
          ),
        )
        .limit(1);
      if (followRel.length > 0) {
        isFollowing = followRel[0]!.status === 'accepted';
        isFollowPending = followRel[0]!.status === 'pending';
      }
    }
  }

  return {
    actorUri: r.actorUri,
    inbox: r.inbox,
    preferredUsername: r.preferredUsername,
    displayName: r.displayName,
    summary: r.summary,
    avatarUrl: r.avatarUrl,
    bannerUrl: r.bannerUrl,
    instanceDomain: r.instanceDomain,
    followerCount: r.followerCount,
    followingCount: r.followingCount,
    isFollowing,
    isFollowPending,
  };
}

// --- Follow Management ---

export async function sendFollow(
  db: DB,
  localUserId: string,
  remoteActorUri: string,
  domain: string,
): Promise<{ id: string }> {
  const user = await db.select().from(users).where(eq(users.id, localUserId)).limit(1);
  if (!user[0]) throw new Error('User not found');

  // CRITICAL: resolve and cache the remote actor so the delivery worker
  // can find their inbox when delivering the Follow
  const resolved = await resolveRemoteActor(db, remoteActorUri).catch(() => null);
  if (!resolved) {
    throw new Error(`Cannot follow: remote actor at ${remoteActorUri} could not be resolved`);
  }

  const localActorUri = `https://${domain}/users/${user[0].username}`;

  const [relationship] = await db
    .insert(followRelationships)
    .values({
      followerActorUri: localActorUri,
      followingActorUri: remoteActorUri,
      status: 'pending',
    })
    .returning();

  const activity = buildFollowActivity(domain, localActorUri, remoteActorUri);

  await db.insert(activities).values({
    type: 'Follow',
    actorUri: localActorUri,
    objectUri: remoteActorUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });

  return { id: relationship!.id };
}

export async function acceptFollow(
  db: DB,
  followRelationshipId: string,
  domain: string,
): Promise<void> {
  const [relationship] = await db
    .select()
    .from(followRelationships)
    .where(eq(followRelationships.id, followRelationshipId))
    .limit(1);

  if (!relationship) throw new Error('Follow relationship not found');

  await db
    .update(followRelationships)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(eq(followRelationships.id, followRelationshipId));

  const activity = buildAcceptActivity(
    domain,
    relationship.followingActorUri,
    relationship.followerActorUri,
  );

  await db.insert(activities).values({
    type: 'Accept',
    actorUri: relationship.followingActorUri,
    objectUri: relationship.followerActorUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

export async function rejectFollow(
  db: DB,
  followRelationshipId: string,
  domain: string,
): Promise<void> {
  const [relationship] = await db
    .select()
    .from(followRelationships)
    .where(eq(followRelationships.id, followRelationshipId))
    .limit(1);

  if (!relationship) throw new Error('Follow relationship not found');

  await db
    .update(followRelationships)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(followRelationships.id, followRelationshipId));

  const activity = buildRejectActivity(
    domain,
    relationship.followingActorUri,
    relationship.followerActorUri,
  );

  await db.insert(activities).values({
    type: 'Reject',
    actorUri: relationship.followingActorUri,
    objectUri: relationship.followerActorUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

export async function unfollowRemote(
  db: DB,
  localUserId: string,
  remoteActorUri: string,
  domain: string,
): Promise<void> {
  const user = await db.select().from(users).where(eq(users.id, localUserId)).limit(1);
  if (!user[0]) throw new Error('User not found');

  const localActorUri = `https://${domain}/users/${user[0].username}`;

  await db
    .delete(followRelationships)
    .where(
      and(
        eq(followRelationships.followerActorUri, localActorUri),
        eq(followRelationships.followingActorUri, remoteActorUri),
      ),
    );

  const activity = buildUndoActivity(domain, localActorUri, remoteActorUri);

  await db.insert(activities).values({
    type: 'Undo',
    actorUri: localActorUri,
    objectUri: remoteActorUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

// --- Content Federation ---

export async function federateContent(db: DB, contentId: string, domain: string): Promise<void> {
  const rows = await db
    .select({
      content: contentItems,
      author: { username: users.username, displayName: users.displayName },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (!rows[0]) return;

  // Only federate published content — guard against callers passing draft/archived content
  if (rows[0].content.status !== 'published') return;

  const { content, author } = rows[0];

  // Fetch content tags for hashtag export
  const tagRows = await db
    .select({ name: tags.name })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, contentId));
  const tagNames = tagRows.map((t) => t.name);

  const actorUri = `https://${domain}/users/${author.username}`;
  const article = contentToArticle({ ...content, tags: tagNames }, author, domain);
  const activity = buildCreateActivity(domain, actorUri, article);

  await db.insert(activities).values({
    type: 'Create',
    actorUri,
    objectUri: article.id,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

export async function federateUpdate(db: DB, contentId: string, domain: string): Promise<void> {
  const rows = await db
    .select({
      content: contentItems,
      author: { username: users.username, displayName: users.displayName },
    })
    .from(contentItems)
    .innerJoin(users, eq(contentItems.authorId, users.id))
    .where(eq(contentItems.id, contentId))
    .limit(1);

  if (!rows[0]) return;

  // Only federate published content — drafts and archived content should not be sent
  if (rows[0].content.status !== 'published') return;

  const { content, author } = rows[0];

  // Fetch content tags for hashtag export
  const tagRows = await db
    .select({ name: tags.name })
    .from(contentTags)
    .innerJoin(tags, eq(contentTags.tagId, tags.id))
    .where(eq(contentTags.contentId, contentId));
  const tagNames = tagRows.map((t) => t.name);

  const actorUri = `https://${domain}/users/${author.username}`;
  const article = contentToArticle({ ...content, tags: tagNames }, author, domain);
  const activity = buildUpdateActivity(domain, actorUri, article);

  await db.insert(activities).values({
    type: 'Update',
    actorUri,
    objectUri: article.id,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

export async function federateDelete(
  db: DB,
  contentId: string,
  domain: string,
  authorUsername: string,
): Promise<void> {
  // Look up slug to construct the canonical URI matching the original Create activity
  const rows = await db
    .select({ slug: contentItems.slug })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);

  const slug = rows[0]?.slug;
  const actorUri = `https://${domain}/users/${authorUsername}`;
  // Use slug-based URI (matches contentToArticle output); fall back to UUID if content already purged
  const objectUri = `https://${domain}/content/${slug ?? contentId}`;
  const activity = buildDeleteActivity(domain, actorUri, objectUri, 'Article');

  await db.insert(activities).values({
    type: 'Delete',
    actorUri,
    objectUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

export async function federateLike(
  db: DB,
  userId: string,
  contentUri: string,
  domain: string,
): Promise<void> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return;

  const actorUri = `https://${domain}/users/${user[0].username}`;
  const activity = buildLikeActivity(domain, actorUri, contentUri);

  await db.insert(activities).values({
    type: 'Like',
    actorUri,
    objectUri: contentUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

export async function federateUnlike(
  db: DB,
  userId: string,
  contentUri: string,
  domain: string,
): Promise<void> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return;

  const actorUri = `https://${domain}/users/${user[0].username}`;
  const activity = buildUndoActivity(domain, actorUri, contentUri);

  await db.insert(activities).values({
    type: 'Undo',
    actorUri,
    objectUri: contentUri,
    payload: activity,
    direction: 'outbound',
    status: 'pending',
  });
}

/** Build a content URI from a slug and domain (matches contentToArticle output) */
export function buildContentUri(domain: string, slug: string): string {
  return `https://${domain}/content/${slug}`;
}

/** Look up content slug by ID for federation URI construction */
export async function getContentSlugById(
  db: DB,
  contentId: string,
): Promise<string | null> {
  const rows = await db
    .select({ slug: contentItems.slug })
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
  return rows[0]?.slug ?? null;
}

// --- Queries ---

export async function getFollowers(
  db: DB,
  actorUri: string,
): Promise<Array<{ followerActorUri: string; status: string }>> {
  return db
    .select({
      followerActorUri: followRelationships.followerActorUri,
      status: followRelationships.status,
    })
    .from(followRelationships)
    .where(
      and(
        eq(followRelationships.followingActorUri, actorUri),
        eq(followRelationships.status, 'accepted'),
      ),
    );
}

export async function getFollowing(
  db: DB,
  actorUri: string,
): Promise<Array<{ followingActorUri: string; status: string }>> {
  return db
    .select({
      followingActorUri: followRelationships.followingActorUri,
      status: followRelationships.status,
    })
    .from(followRelationships)
    .where(
      and(
        eq(followRelationships.followerActorUri, actorUri),
        eq(followRelationships.status, 'accepted'),
      ),
    );
}

export async function listFederationActivity(
  db: DB,
  filters: {
    direction?: 'inbound' | 'outbound';
    status?: 'pending' | 'delivered' | 'failed' | 'processed';
    type?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  items: Array<{
    id: string;
    type: string;
    actorUri: string;
    objectUri: string | null;
    direction: string;
    status: string;
    attempts: number;
    error: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  const conditions = [];

  if (filters.direction) {
    conditions.push(eq(activities.direction, filters.direction));
  }
  if (filters.status) {
    conditions.push(
      eq(activities.status, filters.status),
    );
  }
  if (filters.type) {
    conditions.push(eq(activities.type, filters.type));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(where)
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(activities)
      .where(where),
  ]);

  return {
    items: rows,
    total: countResult[0]?.count ?? 0,
  };
}
