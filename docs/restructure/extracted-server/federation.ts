import { eq, and, desc, sql } from 'drizzle-orm';
import {
  users,
  remoteActors,
  activities,
  followRelationships,
  actorKeypairs,
  contentItems,
} from '@commonpub/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  generateKeypair,
  exportPublicKeyPem,
  exportPrivateKeyPem,
  resolveActor,
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

type DB = NodePgDatabase<Record<string, unknown>>;

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
        publicKey: c.publicKeyPem
          ? { id: `${c.actorUri}#main-key`, owner: c.actorUri, publicKeyPem: c.publicKeyPem }
          : undefined,
      };
    }
  }

  // Fetch from remote
  const actor = await resolveActor(actorUri, fetch);
  if (!actor) return null;

  // Extract domain
  const url = new URL(actorUri);
  const instanceDomain = url.hostname;

  // Upsert cache
  if (cached.length > 0) {
    await db
      .update(remoteActors)
      .set({
        inbox: actor.inbox,
        outbox: actor.outbox,
        publicKeyPem: actor.publicKey?.publicKeyPem,
        preferredUsername: actor.preferredUsername,
        displayName: actor.name,
        avatarUrl: actor.icon?.url,
        lastFetchedAt: new Date(),
      })
      .where(eq(remoteActors.actorUri, actorUri));
  } else {
    await db.insert(remoteActors).values({
      actorUri,
      inbox: actor.inbox,
      outbox: actor.outbox,
      publicKeyPem: actor.publicKey?.publicKeyPem,
      preferredUsername: actor.preferredUsername,
      displayName: actor.name,
      avatarUrl: actor.icon?.url,
      instanceDomain,
      lastFetchedAt: new Date(),
    });
  }

  return actor;
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

  const localActorUri = `https://${domain}/users/${user[0].username}`;

  // Create follow relationship
  const [relationship] = await db
    .insert(followRelationships)
    .values({
      followerActorUri: localActorUri,
      followingActorUri: remoteActorUri,
      status: 'pending',
    })
    .returning();

  // Build and log the Follow activity
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

  // Find and remove relationship
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

  const { content, author } = rows[0];
  const actorUri = `https://${domain}/users/${author.username}`;
  const article = contentToArticle(content, author, domain);
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

  const { content, author } = rows[0];
  const actorUri = `https://${domain}/users/${author.username}`;
  const article = contentToArticle(content, author, domain);
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
  const actorUri = `https://${domain}/users/${authorUsername}`;
  const objectUri = `https://${domain}/content/${contentId}`;
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
    status?: string;
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
      eq(activities.status, filters.status as 'pending' | 'delivered' | 'failed' | 'processed'),
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
