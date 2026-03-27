/**
 * Instance mirroring — subscribe to all content from a remote instance.
 * Uses standard AP semantics: instance B's Service actor follows instance A's Service actor.
 * Content arrives via normal inbox Create activities, filtered by mirror config.
 */
import { eq, and, sql } from 'drizzle-orm';
import {
  instanceMirrors,
  federatedContent,
  activities,
  followRelationships,
} from '@commonpub/schema';
import { buildFollowActivity } from '@commonpub/protocol';
import type { DB } from '../types.js';

export interface MirrorConfig {
  id: string;
  remoteDomain: string;
  remoteActorUri: string;
  status: string;
  direction: string;
  filterContentTypes: string[] | null;
  filterTags: string[] | null;
  contentCount: number;
  errorCount: number;
  lastError: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

/**
 * Create a new instance mirror subscription.
 * The instance actor will follow the remote instance actor to receive content.
 */
export async function createMirror(
  db: DB,
  remoteDomain: string,
  remoteActorUri: string,
  direction: 'pull' | 'push',
  localDomain: string,
  filters?: { contentTypes?: string[]; tags?: string[] },
): Promise<MirrorConfig> {
  const [row] = await db
    .insert(instanceMirrors)
    .values({
      remoteDomain,
      remoteActorUri,
      direction,
      status: 'active', // Start as active immediately
      filterContentTypes: filters?.contentTypes ?? null,
      filterTags: filters?.tags ?? null,
    })
    .returning();

  // For pull mirrors: Follow the remote instance actor so they deliver content to us
  if (direction === 'pull') {
    const localActorUri = `https://${localDomain}/actor`;
    const followActivity = buildFollowActivity(localDomain, localActorUri, remoteActorUri);

    // Store the follow relationship so the remote can find us
    await db.insert(followRelationships).values({
      followerActorUri: localActorUri,
      followingActorUri: remoteActorUri,
      status: 'pending',
    }).onConflictDoNothing();

    // Queue the Follow for delivery
    await db.insert(activities).values({
      type: 'Follow',
      actorUri: localActorUri,
      objectUri: remoteActorUri,
      payload: followActivity,
      direction: 'outbound',
      status: 'pending',
    });
  }

  return mirrorRowToConfig(row!);
}

/**
 * Activate a pending mirror (called after the Follow is accepted).
 */
export async function activateMirror(db: DB, mirrorId: string): Promise<void> {
  await db
    .update(instanceMirrors)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(instanceMirrors.id, mirrorId));
}

/**
 * Pause a mirror — stops content ingestion but keeps the follow active.
 */
export async function pauseMirror(db: DB, mirrorId: string): Promise<void> {
  await db
    .update(instanceMirrors)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(instanceMirrors.id, mirrorId));
}

/**
 * Resume a paused mirror.
 */
export async function resumeMirror(db: DB, mirrorId: string): Promise<void> {
  await db
    .update(instanceMirrors)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(instanceMirrors.id, mirrorId));
}

/**
 * Cancel a mirror — removes the subscription entirely.
 * Content already received is NOT deleted (can be cleaned up separately).
 */
export async function cancelMirror(db: DB, mirrorId: string): Promise<void> {
  await db.delete(instanceMirrors).where(eq(instanceMirrors.id, mirrorId));
}

/**
 * List all instance mirrors with stats.
 */
export async function listMirrors(db: DB): Promise<MirrorConfig[]> {
  const rows = await db.select().from(instanceMirrors).orderBy(instanceMirrors.createdAt);
  return rows.map(mirrorRowToConfig);
}

/**
 * Get a single mirror by ID.
 */
export async function getMirror(db: DB, mirrorId: string): Promise<MirrorConfig | null> {
  const [row] = await db
    .select()
    .from(instanceMirrors)
    .where(eq(instanceMirrors.id, mirrorId))
    .limit(1);
  return row ? mirrorRowToConfig(row) : null;
}

/**
 * Check if inbound content should be accepted by a mirror.
 * Applies content type and tag filters.
 * Returns the mirror ID if accepted, null if rejected.
 *
 * CRITICAL FOR LOOP PREVENTION:
 * - Only accepts content from the mirror's remoteDomain
 * - Rejects content that originated from our own domain (checked upstream in onCreate)
 */
export async function matchMirrorForContent(
  db: DB,
  originDomain: string,
  apType: string,
  cpubType: string | null,
  tags: Array<{ name: string }>,
): Promise<string | null> {
  // Find active mirror for this origin domain
  const [mirror] = await db
    .select()
    .from(instanceMirrors)
    .where(
      and(
        eq(instanceMirrors.remoteDomain, originDomain),
        eq(instanceMirrors.status, 'active'),
        eq(instanceMirrors.direction, 'pull'),
      ),
    )
    .limit(1);

  if (!mirror) return null;

  // Apply content type filter
  if (mirror.filterContentTypes) {
    const allowedTypes = mirror.filterContentTypes as string[];
    const contentType = cpubType ?? apType.toLowerCase();
    if (!allowedTypes.includes(contentType)) return null;
  }

  // Apply tag filter
  if (mirror.filterTags) {
    const requiredTags = mirror.filterTags as string[];
    const contentTags = tags.map((t) => t.name.toLowerCase().replace(/^#/, ''));
    const hasMatchingTag = requiredTags.some((rt) =>
      contentTags.includes(rt.toLowerCase().replace(/^#/, '')),
    );
    if (!hasMatchingTag) return null;
  }

  // Update mirror stats
  await db
    .update(instanceMirrors)
    .set({
      contentCount: sql`${instanceMirrors.contentCount} + 1`,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(instanceMirrors.id, mirror.id));

  return mirror.id;
}

/**
 * Record a mirror error (for admin visibility).
 */
export async function recordMirrorError(
  db: DB,
  mirrorId: string,
  error: string,
): Promise<void> {
  await db
    .update(instanceMirrors)
    .set({
      errorCount: sql`${instanceMirrors.errorCount} + 1`,
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(instanceMirrors.id, mirrorId));
}

function mirrorRowToConfig(row: typeof instanceMirrors.$inferSelect): MirrorConfig {
  return {
    id: row.id,
    remoteDomain: row.remoteDomain,
    remoteActorUri: row.remoteActorUri,
    status: row.status,
    direction: row.direction,
    filterContentTypes: row.filterContentTypes as string[] | null,
    filterTags: row.filterTags as string[] | null,
    contentCount: row.contentCount,
    errorCount: row.errorCount,
    lastError: row.lastError,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
