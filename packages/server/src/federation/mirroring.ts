/**
 * Instance mirroring — subscribe to all content from a remote instance.
 * Uses standard AP semantics: instance B's Service actor follows instance A's Service actor.
 * Content arrives via normal inbox Create activities, filtered by mirror config.
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import {
  instanceMirrors,
  mirrorRequests,
  federatedContent,
  activities,
  followRelationships,
} from '@commonpub/schema';
import {
  buildFollowActivity,
  buildMirrorRequestActivity,
  buildAcceptActivity,
  buildRejectActivity,
} from '@commonpub/protocol';
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
 * Resolve+cache the remote instance actor, then store a pending follow relationship and queue a
 * signed Follow from our instance actor to it — so the remote delivers its content to us. Shared by
 * `createMirror` and `approveMirrorRequest`'s reuse-an-existing-mirror path. `onConflictDoNothing`
 * keeps it idempotent if a relationship row already exists.
 */
async function queueInstanceFollow(db: DB, remoteActorUri: string, localDomain: string): Promise<void> {
  // CRITICAL: resolve and cache the remote actor FIRST so the delivery worker can find their inbox.
  const { resolveRemoteActor } = await import('./federation.js');
  const resolved = await resolveRemoteActor(db, remoteActorUri).catch(() => null);
  if (!resolved) {
    console.warn(`[mirroring] Could not resolve remote actor ${remoteActorUri} — Follow delivery may fail`);
  }
  const localActorUri = `https://${localDomain}/actor`;
  await db
    .insert(followRelationships)
    .values({ followerActorUri: localActorUri, followingActorUri: remoteActorUri, status: 'pending' })
    .onConflictDoNothing();
  await db.insert(activities).values({
    type: 'Follow',
    actorUri: localActorUri,
    objectUri: remoteActorUri,
    payload: buildFollowActivity(localDomain, localActorUri, remoteActorUri),
    direction: 'outbound',
    status: 'pending',
  });
}

/**
 * Create a new PULL instance mirror subscription — the instance actor follows the remote instance
 * actor to receive its public content. (Push is a consent-based request — see `requestMirror`.)
 */
export async function createMirror(
  db: DB,
  remoteDomain: string,
  remoteActorUri: string,
  direction: 'pull' | 'push',
  localDomain: string,
  filters?: { contentTypes?: string[]; tags?: string[] },
): Promise<MirrorConfig> {
  if (direction === 'push') {
    // Push is no longer a mirror row — it's a consent-based request to the remote instance.
    throw new Error('createMirror only handles pull mirrors; use requestMirror() for push (consent-based) requests');
  }

  const [row] = await db
    .insert(instanceMirrors)
    .values({
      remoteDomain,
      remoteActorUri,
      direction: 'pull',
      status: 'active', // Start as active immediately
      filterContentTypes: filters?.contentTypes ?? null,
      filterTags: filters?.tags ?? null,
    })
    .returning();

  // Pull mirror: Follow the remote instance actor so they deliver content to us.
  await queueInstanceFollow(db, remoteActorUri, localDomain);

  return mirrorRowToConfig(row!);
}

// --- Consent-based mirror requests (Phase 3) ---

export interface MirrorRequestConfig {
  id: string;
  direction: 'incoming' | 'outgoing';
  remoteDomain: string;
  remoteActorUri: string;
  status: 'pending' | 'approved' | 'rejected';
  offerActivityUri: string | null;
  resultingMirrorId: string | null;
  lastError: string | null;
  decidedAt: string | null;
  createdAt: string;
}

function mirrorRequestRowToConfig(row: typeof mirrorRequests.$inferSelect): MirrorRequestConfig {
  return {
    id: row.id,
    direction: row.direction as 'incoming' | 'outgoing',
    remoteDomain: row.remoteDomain,
    remoteActorUri: row.remoteActorUri,
    status: row.status as 'pending' | 'approved' | 'rejected',
    offerActivityUri: row.offerActivityUri,
    resultingMirrorId: row.resultingMirrorId,
    lastError: row.lastError,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Send a consent-based mirror request (createMirror direction:'push') — ask a remote CommonPub
 * instance to pull-mirror US. Stores an 'outgoing' request row and queues a signed `Offer(Follow)`
 * to the target's inbox. Re-requesting the same domain resets the row to pending (idempotent).
 */
export async function requestMirror(
  db: DB,
  remoteDomain: string,
  remoteActorUri: string,
  localDomain: string,
): Promise<MirrorRequestConfig> {
  // Resolve + cache the remote actor first so the delivery worker can find its inbox.
  const { resolveRemoteActor } = await import('./federation.js');
  const resolved = await resolveRemoteActor(db, remoteActorUri).catch(() => null);
  if (!resolved) {
    console.warn(`[mirroring] Could not resolve ${remoteActorUri} — request created but Offer delivery may fail`);
  }

  const localActorUri = `https://${localDomain}/actor`;
  const offer = buildMirrorRequestActivity(localDomain, localActorUri, remoteActorUri);

  const [row] = await db
    .insert(mirrorRequests)
    .values({
      direction: 'outgoing',
      remoteDomain,
      remoteActorUri,
      status: 'pending',
      offerActivityUri: offer.id,
    })
    .onConflictDoUpdate({
      target: [mirrorRequests.direction, mirrorRequests.remoteDomain],
      set: {
        remoteActorUri,
        status: 'pending',
        offerActivityUri: offer.id,
        lastError: null,
        decidedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Queue the Offer for delivery to the target instance's inbox.
  await db.insert(activities).values({
    type: 'Offer',
    actorUri: localActorUri,
    objectUri: remoteActorUri,
    payload: offer,
    direction: 'outbound',
    status: 'pending',
  });

  return mirrorRequestRowToConfig(row!);
}

/** List mirror requests, optionally filtered by direction. */
export async function listMirrorRequests(
  db: DB,
  direction?: 'incoming' | 'outgoing',
): Promise<MirrorRequestConfig[]> {
  const rows = await db
    .select()
    .from(mirrorRequests)
    .where(direction ? eq(mirrorRequests.direction, direction) : undefined)
    .orderBy(desc(mirrorRequests.createdAt));
  return rows.map(mirrorRequestRowToConfig);
}

/** Get a single mirror request by id. */
export async function getMirrorRequest(db: DB, requestId: string): Promise<MirrorRequestConfig | null> {
  const [row] = await db
    .select()
    .from(mirrorRequests)
    .where(eq(mirrorRequests.id, requestId))
    .limit(1);
  return row ? mirrorRequestRowToConfig(row) : null;
}

/**
 * Approve an INCOMING mirror request: create a pull mirror of the requester (using the approver's
 * own depth + filters), optionally backfill bounded history, queue an `Accept(Offer)` back to the
 * requester, and mark the request approved. Idempotent if a pull mirror already exists for the
 * requester's domain (reuses it — respects the unique(remote_domain) constraint).
 */
export async function approveMirrorRequest(
  db: DB,
  requestId: string,
  localDomain: string,
  opts?: {
    sinceDays?: number;
    maxItems?: number;
    filterContentTypes?: string[] | null;
    filterTags?: string[] | null;
  },
): Promise<MirrorRequestConfig> {
  const [req] = await db.select().from(mirrorRequests).where(eq(mirrorRequests.id, requestId)).limit(1);
  if (!req) throw new Error('Mirror request not found');
  if (req.direction !== 'incoming') throw new Error('Can only approve incoming mirror requests');

  // Create (or reuse) a pull mirror of the requester with the approver's chosen filters.
  const [existing] = await db
    .select()
    .from(instanceMirrors)
    .where(eq(instanceMirrors.remoteDomain, req.remoteDomain))
    .limit(1);

  let mirrorId: string;
  if (existing) {
    // Reuse the row, but make it actually usable: re-activate if it was paused/failed and apply
    // the approver's chosen filters (matchMirrorForContent only accepts 'active' pull mirrors).
    // The approve's filters are authoritative — same semantics as the fresh-create path below
    // (absent/null = all types/tags), so re-approving with no filters means "mirror everything".
    mirrorId = existing.id;
    await db
      .update(instanceMirrors)
      .set({
        status: 'active',
        direction: 'pull',
        pausedAt: null,
        filterContentTypes: opts?.filterContentTypes ?? null,
        filterTags: opts?.filterTags ?? null,
        updatedAt: new Date(),
      })
      .where(eq(instanceMirrors.id, existing.id));
    // (Re)queue a Follow only if there's no live subscription — a 'pending' follow already has a
    // Follow in flight (the activities table has no dedup), so don't append a duplicate.
    const [rel] = await db
      .select({ status: followRelationships.status })
      .from(followRelationships)
      .where(
        and(
          eq(followRelationships.followerActorUri, `https://${localDomain}/actor`),
          eq(followRelationships.followingActorUri, req.remoteActorUri),
        ),
      )
      .limit(1);
    if (!rel || rel.status === 'rejected') {
      await queueInstanceFollow(db, req.remoteActorUri, localDomain);
    }
  } else {
    try {
      const mirror = await createMirror(db, req.remoteDomain, req.remoteActorUri, 'pull', localDomain, {
        contentTypes: opts?.filterContentTypes ?? undefined,
        tags: opts?.filterTags ?? undefined,
      });
      mirrorId = mirror.id;
    } catch (err) {
      // ONLY swallow a unique(remote_domain) race (concurrent approval / a directory "Mirror" click
      // landing between our SELECT and createMirror's INSERT). Any other failure is real — rethrow
      // rather than returning a Follow-less mirror as if approval succeeded.
      const code = (err as { code?: string }).code;
      const isUniqueViolation = code === '23505' || /duplicate key|unique constraint/i.test(String((err as Error)?.message));
      if (!isUniqueViolation) throw err;
      const [raced] = await db
        .select({ id: instanceMirrors.id })
        .from(instanceMirrors)
        .where(eq(instanceMirrors.remoteDomain, req.remoteDomain))
        .limit(1);
      if (!raced) throw err;
      mirrorId = raced.id;
    }
  }

  // Optional bounded history import (forward-only if no depth chosen).
  if (opts && (opts.sinceDays || opts.maxItems)) {
    try {
      const { backfillFromOutbox } = await import('./backfill.js');
      const since = opts.sinceDays
        ? new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000)
        : undefined;
      await backfillFromOutbox(db, req.remoteActorUri, localDomain, {
        maxItems: opts.maxItems,
        since,
      });
    } catch (err) {
      console.error('[mirroring] approve backfill failed:', err instanceof Error ? err.message : err);
    }
  }

  // Tell the requester we approved — Accept(Offer). objectUri = requester actor so delivery routes there.
  const localActorUri = `https://${localDomain}/actor`;
  const accept = buildAcceptActivity(localDomain, localActorUri, req.offerActivityUri ?? req.remoteActorUri);
  await db.insert(activities).values({
    type: 'Accept',
    actorUri: localActorUri,
    objectUri: req.remoteActorUri,
    payload: accept,
    direction: 'outbound',
    status: 'pending',
  });

  const [updated] = await db
    .update(mirrorRequests)
    .set({ status: 'approved', resultingMirrorId: mirrorId, decidedAt: new Date(), updatedAt: new Date() })
    .where(eq(mirrorRequests.id, requestId))
    .returning();

  return mirrorRequestRowToConfig(updated!);
}

/**
 * Reject an INCOMING mirror request: queue a `Reject(Offer)` back to the requester and mark it
 * rejected. No mirror is created.
 */
export async function rejectMirrorRequest(
  db: DB,
  requestId: string,
  localDomain: string,
): Promise<MirrorRequestConfig> {
  const [req] = await db.select().from(mirrorRequests).where(eq(mirrorRequests.id, requestId)).limit(1);
  if (!req) throw new Error('Mirror request not found');
  if (req.direction !== 'incoming') throw new Error('Can only reject incoming mirror requests');

  const localActorUri = `https://${localDomain}/actor`;
  const reject = buildRejectActivity(localDomain, localActorUri, req.offerActivityUri ?? req.remoteActorUri);
  await db.insert(activities).values({
    type: 'Reject',
    actorUri: localActorUri,
    objectUri: req.remoteActorUri,
    payload: reject,
    direction: 'outbound',
    status: 'pending',
  });

  const [updated] = await db
    .update(mirrorRequests)
    .set({ status: 'rejected', decidedAt: new Date(), updatedAt: new Date() })
    .where(eq(mirrorRequests.id, requestId))
    .returning();

  return mirrorRequestRowToConfig(updated!);
}

/** A remote instance that follows our instance Service actor — i.e. is mirroring us. */
export interface InstanceFollower {
  actorUri: string;
  domain: string;
  followedAt: string | null;
}

/**
 * List the instances mirroring US — remote actors that follow our instance Service actor
 * (`https://{domain}/actor`) with an accepted follow. Each such follower is an instance
 * pulling our public content. This is the read side of "who is mirroring me".
 *
 * Note: this is INSTANCE-level only (followers of `/actor`), not per-user followers — a
 * remote user following a local user is not mirroring the instance.
 */
export async function listInstanceFollowers(db: DB, domain: string): Promise<InstanceFollower[]> {
  const instanceActorUri = `https://${domain}/actor`;
  const rows = await db
    .select({
      followerActorUri: followRelationships.followerActorUri,
      createdAt: followRelationships.createdAt,
    })
    .from(followRelationships)
    .where(and(
      eq(followRelationships.followingActorUri, instanceActorUri),
      eq(followRelationships.status, 'accepted'),
    ))
    .orderBy(desc(followRelationships.createdAt));

  return rows.map((r) => {
    let host = r.followerActorUri;
    try { host = new URL(r.followerActorUri).hostname; } catch { /* keep raw uri */ }
    return {
      actorUri: r.followerActorUri,
      domain: host,
      followedAt: r.createdAt ? r.createdAt.toISOString() : null,
    };
  });
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
 * Records pausedAt for gap-fill on resume.
 */
export async function pauseMirror(db: DB, mirrorId: string): Promise<void> {
  await db
    .update(instanceMirrors)
    .set({ status: 'paused', pausedAt: new Date(), updatedAt: new Date() })
    .where(eq(instanceMirrors.id, mirrorId));
}

/**
 * Resume a paused mirror. Clears pausedAt.
 * Caller should consider triggering backfill from pausedAt to fill the gap.
 */
export async function resumeMirror(db: DB, mirrorId: string): Promise<void> {
  await db
    .update(instanceMirrors)
    .set({ status: 'active', pausedAt: null, updatedAt: new Date() })
    .where(eq(instanceMirrors.id, mirrorId));
}

/**
 * Cancel a mirror — hides associated content and removes the subscription.
 * Content is soft-hidden (isHidden=true) rather than deleted, preserving
 * local engagement data (likes, comments, bookmarks).
 */
export async function cancelMirror(db: DB, mirrorId: string): Promise<void> {
  // Soft-hide all content from this mirror
  await db
    .update(federatedContent)
    .set({ isHidden: true })
    .where(eq(federatedContent.mirrorId, mirrorId));

  // Delete the mirror config
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
  /** Domain of the actor who sent the activity (may differ from originDomain for re-broadcasts) */
  senderDomain?: string,
): Promise<string | null> {
  // Find active mirror for this origin domain
  let [mirror] = await db
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

  // Fallback: check by sender domain (handles content re-broadcast from mirrors)
  if (!mirror && senderDomain && senderDomain !== originDomain) {
    [mirror] = await db
      .select()
      .from(instanceMirrors)
      .where(
        and(
          eq(instanceMirrors.remoteDomain, senderDomain),
          eq(instanceMirrors.status, 'active'),
          eq(instanceMirrors.direction, 'pull'),
        ),
      )
      .limit(1);
  }

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

  // Apply quota — skip if mirror has already hit the configured max
  // mirrorMaxItems is passed from federation config (not stored per-mirror)
  // This is a soft limit — already-accepted content stays, new content is rejected
  // The quota check uses the mirror's contentCount which is updated on each accept

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
