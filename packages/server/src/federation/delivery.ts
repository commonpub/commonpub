/**
 * Activity delivery — sends pending outbound AP activities to remote inboxes.
 * Signs requests with HTTP Signatures and updates delivery status.
 */
import { eq, and, sql, lte, isNull, or } from 'drizzle-orm';
import { activities, remoteActors, followRelationships, actorKeypairs, users, hubs, hubActorKeypairs, hubFollowers } from '@commonpub/schema';
import { signRequest } from '@commonpub/protocol';
import type { DB } from '../types.js';

const DEFAULT_MAX_ATTEMPTS = 6;
/** Lock expiry: if a worker crashes, its locks expire after 5 minutes */
const LOCK_EXPIRY_MS = 5 * 60 * 1000;
const CONTENT_TYPE_AP = 'application/activity+json';

/** Exponential backoff delays in milliseconds: 1m, 5m, 30m, 2h, 12h, 48h */
const BACKOFF_DELAYS_MS = [
  60_000,         // 1 minute
  300_000,        // 5 minutes
  1_800_000,      // 30 minutes
  7_200_000,      // 2 hours
  43_200_000,     // 12 hours
  172_800_000,    // 48 hours
];

/** Calculate whether an activity is ready for retry based on exponential backoff */
function isReadyForRetry(attempts: number, updatedAt: Date): boolean {
  if (attempts === 0) return true; // Never attempted
  const delay = BACKOFF_DELAYS_MS[Math.min(attempts - 1, BACKOFF_DELAYS_MS.length - 1)]!;
  return Date.now() >= updatedAt.getTime() + delay;
}

export interface DeliveryResult {
  delivered: number;
  failed: number;
  errors: string[];
}

export interface DeliveryOptions {
  batchSize?: number;
  maxRetries?: number;
}

/**
 * Process and deliver pending outbound activities.
 * Uses claim-based locking for multi-worker safety:
 * each worker claims activities by setting lockedAt, preventing duplicates.
 */
export async function deliverPendingActivities(
  db: DB,
  domain: string,
  batchSizeOrOpts?: number | DeliveryOptions,
): Promise<DeliveryResult> {
  const opts = typeof batchSizeOrOpts === 'number'
    ? { batchSize: batchSizeOrOpts }
    : batchSizeOrOpts ?? {};
  const batchSize = opts.batchSize ?? 20;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_ATTEMPTS;

  const result: DeliveryResult = { delivered: 0, failed: 0, errors: [] };
  const now = new Date();
  const lockExpiry = new Date(now.getTime() - LOCK_EXPIRY_MS);

  // Fetch pending outbound activities — only unlocked (lockedAt IS NULL or lock expired)
  const candidates = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'pending'),
        lte(activities.attempts, maxRetries),
        isNull(activities.deadLetteredAt),
        or(
          isNull(activities.lockedAt),
          lte(activities.lockedAt, lockExpiry),
        ),
      ),
    )
    .orderBy(activities.createdAt)
    .limit(batchSize * 2);

  // Apply exponential backoff filter in-memory
  const pending = candidates.filter((a) => isReadyForRetry(a.attempts, a.updatedAt)).slice(0, batchSize);

  // Claim activities by setting lockedAt (prevents other workers from picking them up)
  const claimedIds: string[] = [];
  for (const activity of pending) {
    const claimed = await db.update(activities)
      .set({ lockedAt: now })
      .where(and(
        eq(activities.id, activity.id),
        or(isNull(activities.lockedAt), lte(activities.lockedAt, lockExpiry)),
      ))
      .returning({ id: activities.id });
    if (claimed.length > 0) claimedIds.push(activity.id);
  }

  // Only process activities we successfully claimed
  const toClaim = pending.filter((a) => claimedIds.includes(a.id));

  for (const activity of toClaim) {
    try {
      await deliverActivity(db, activity, domain);
      result.delivered++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${activity.id}: ${errorMsg}`);
      result.failed++;
    }
  }

  return result;
}

async function deliverActivity(
  db: DB,
  activity: typeof activities.$inferSelect,
  domain: string,
): Promise<void> {
  const payload = activity.payload as Record<string, unknown>;
  if (!payload) {
    await markFailed(db, activity.id, 'No payload');
    return;
  }

  // Determine the target inbox(es)
  const targetInboxes = await resolveTargetInboxes(db, activity, domain);
  if (targetInboxes.length === 0) {
    await markFailed(db, activity.id, 'No target inboxes found');
    return;
  }

  // Get the signing keypair for the actor
  const keypair = await getKeypairForActor(db, activity.actorUri, domain);
  if (!keypair) {
    await markFailed(db, activity.id, 'No keypair for actor');
    return;
  }

  const keyId = `${activity.actorUri}#main-key`;
  const body = JSON.stringify(payload);

  // Deliver to each inbox (with circuit breaker checks)
  const { isCircuitOpen, recordDeliverySuccess, recordDeliveryFailure } = await import('./circuitBreaker.js');
  const errors: string[] = [];
  let skippedCircuitOpen = 0;

  for (const inbox of targetInboxes) {
    // Extract domain from inbox URL for circuit breaker
    let inboxDomain: string;
    try { inboxDomain = new URL(inbox).hostname; } catch { inboxDomain = inbox; }

    // Check circuit breaker — skip if circuit is open for this domain
    const circuitOpen = await isCircuitOpen(db, inboxDomain);
    if (circuitOpen) {
      skippedCircuitOpen++;
      errors.push(`${inbox}: circuit open (skipped)`);
      continue;
    }

    try {
      const request = new Request(inbox, {
        method: 'POST',
        headers: {
          'Content-Type': CONTENT_TYPE_AP,
          'Accept': CONTENT_TYPE_AP,
          'User-Agent': `CommonPub/1.0 (+https://${domain})`,
        },
        body,
      });

      const signed = await signRequest(request, keypair.privateKeyPem, keyId);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await fetch(signed, { signal: controller.signal });
        if (!response.ok && response.status !== 202) {
          errors.push(`${inbox}: ${response.status} ${response.statusText}`);
          await recordDeliveryFailure(db, inboxDomain).catch(() => {});
        } else {
          await recordDeliverySuccess(db, inboxDomain).catch(() => {});
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      errors.push(`${inbox}: ${err instanceof Error ? err.message : String(err)}`);
      await recordDeliveryFailure(db, inboxDomain).catch(() => {});
    }
  }

  // If all inboxes were skipped due to circuit breaker, don't count as attempt
  if (skippedCircuitOpen === targetInboxes.length) {
    // All skipped — leave as pending, don't increment attempts
    return;
  }

  if (errors.length === 0) {
    await markDelivered(db, activity.id);
  } else {
    await incrementAttempts(db, activity.id, errors.join('; '));
  }
}

async function resolveTargetInboxes(
  db: DB,
  activity: typeof activities.$inferSelect,
  domain: string,
): Promise<string[]> {
  const inboxes: string[] = [];
  const type = activity.type;

  if (type === 'Accept' || type === 'Reject') {
    // Send to the actor who sent the original Follow
    const targetActorUri = activity.objectUri;
    if (targetActorUri) {
      const actor = await db
        .select({ inbox: remoteActors.inbox })
        .from(remoteActors)
        .where(eq(remoteActors.actorUri, targetActorUri))
        .limit(1);
      if (actor[0]?.inbox) inboxes.push(actor[0].inbox);
    }
  } else if (type === 'Follow') {
    // Send to the target actor's inbox — resolve if not cached
    const targetActorUri = activity.objectUri;
    if (targetActorUri) {
      const actor = await db
        .select({ inbox: remoteActors.inbox })
        .from(remoteActors)
        .where(eq(remoteActors.actorUri, targetActorUri))
        .limit(1);
      if (actor[0]?.inbox) {
        inboxes.push(actor[0].inbox);
      } else {
        // Actor not in cache — resolve it (sendFollow should have cached it, but handle edge cases)
        try {
          const { resolveRemoteActor } = await import('./federation.js');
          const resolved = await resolveRemoteActor(db, targetActorUri);
          if (resolved?.inbox) inboxes.push(resolved.inbox);
        } catch { /* resolution failed — delivery will fail gracefully */ }
      }
    }
  } else if (type === 'Undo') {
    // Undo can wrap Follow (send to target actor) or Like/Announce (fan out to followers).
    // Distinguish by checking if we have/had a follow relationship with the objectUri as target.
    // This is more reliable than checking remoteActors cache (which may miss new instances)
    // or payload structure (which uses plain URI strings, not typed objects).
    const targetUri = activity.objectUri;
    if (targetUri) {
      // Check if this looks like an Undo(Follow) — we had/have a follow relationship to this URI
      const followRel = await db
        .select({ id: followRelationships.id })
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followerActorUri, activity.actorUri),
            eq(followRelationships.followingActorUri, targetUri),
          ),
        )
        .limit(1);

      if (followRel.length > 0) {
        // This is Undo(Follow): send to the target actor's inbox
        const actor = await db
          .select({ inbox: remoteActors.inbox })
          .from(remoteActors)
          .where(eq(remoteActors.actorUri, targetUri))
          .limit(1);
        if (actor[0]?.inbox) inboxes.push(actor[0].inbox);
      } else {
        // This is Undo(Like/Announce): fan out to all accepted followers
        const followers = await db
          .select({ followerActorUri: followRelationships.followerActorUri })
          .from(followRelationships)
          .where(
            and(
              eq(followRelationships.followingActorUri, activity.actorUri),
              eq(followRelationships.status, 'accepted'),
            ),
          );
        for (const f of followers) {
          const followerActor = await db
            .select({ inbox: remoteActors.inbox, sharedInbox: remoteActors.sharedInbox })
            .from(remoteActors)
            .where(eq(remoteActors.actorUri, f.followerActorUri))
            .limit(1);
          const targetInbox = followerActor[0]?.sharedInbox ?? followerActor[0]?.inbox;
          if (targetInbox) inboxes.push(targetInbox);
        }
      }
    }
  } else if (type === 'Create' || type === 'Update' || type === 'Delete' || type === 'Like' || type === 'Announce') {
    // Check for direct messages: Create with specific recipients, no #Public
    const payload = activity.payload as Record<string, unknown> | null;
    const toField = payload?.to as string[] | undefined;
    const ccField = payload?.cc as string[] | undefined;
    const AP_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
    const isPublic = toField?.includes(AP_PUBLIC) || ccField?.includes(AP_PUBLIC);
    const isDM = type === 'Create' && toField && toField.length > 0 && !isPublic;

    if (isDM) {
      // Direct message — deliver to each specific recipient's inbox
      for (const recipientUri of toField!) {
        if (recipientUri === activity.actorUri) continue; // Don't send to self
        const actor = await db
          .select({ inbox: remoteActors.inbox })
          .from(remoteActors)
          .where(eq(remoteActors.actorUri, recipientUri))
          .limit(1);
        if (actor[0]?.inbox) inboxes.push(actor[0].inbox);
      }
      return [...new Set(inboxes)];
    }

    // Deliver to explicit `to` recipients that are specific actors (not #Public)
    // This handles posting to remote Group hubs, replying to specific actors, etc.
    if (toField) {
      for (const recipientUri of toField) {
        if (recipientUri === AP_PUBLIC || recipientUri === activity.actorUri) continue;
        // Check if this is a specific actor (not a followers collection)
        if (recipientUri.includes('/followers')) continue;
        const actor = await db
          .select({ inbox: remoteActors.inbox })
          .from(remoteActors)
          .where(eq(remoteActors.actorUri, recipientUri))
          .limit(1);
        if (actor[0]?.inbox) inboxes.push(actor[0].inbox);
      }
    }

    // Check if this is a hub actor (pattern: /hubs/{slug} in actor URI)
    const actorUrl = new URL(activity.actorUri);
    const actorSegments = actorUrl.pathname.split('/').filter(Boolean);
    const isHubActor = actorSegments.includes('hubs');

    if (isHubActor) {
      // Hub Group actor — resolve from hubFollowers table
      const hubSlug = actorSegments[actorSegments.indexOf('hubs') + 1];
      if (hubSlug) {
        const [hub] = await db.select({ id: hubs.id }).from(hubs).where(eq(hubs.slug, hubSlug)).limit(1);
        if (hub) {
          const hubFols = await db
            .select({ followerActorUri: hubFollowers.followerActorUri })
            .from(hubFollowers)
            .where(and(eq(hubFollowers.hubId, hub.id), eq(hubFollowers.status, 'accepted')));
          for (const f of hubFols) {
            const actor = await db
              .select({ inbox: remoteActors.inbox, sharedInbox: remoteActors.sharedInbox })
              .from(remoteActors)
              .where(eq(remoteActors.actorUri, f.followerActorUri))
              .limit(1);
            const targetInbox = actor[0]?.sharedInbox ?? actor[0]?.inbox;
            if (targetInbox) inboxes.push(targetInbox);
          }
        }
      }

      // Also deliver hub activities to instance actor followers (for mirroring)
      // This ensures instance mirrors receive hub post Announces
      const instanceActorUri = `https://${domain}/actor`;
      const instanceFollowers = await db
        .select({ followerActorUri: followRelationships.followerActorUri })
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followingActorUri, instanceActorUri),
            eq(followRelationships.status, 'accepted'),
          ),
        );
      for (const f of instanceFollowers) {
        const actor = await db
          .select({ inbox: remoteActors.inbox, sharedInbox: remoteActors.sharedInbox })
          .from(remoteActors)
          .where(eq(remoteActors.actorUri, f.followerActorUri))
          .limit(1);
        const targetInbox = actor[0]?.sharedInbox ?? actor[0]?.inbox;
        if (targetInbox) inboxes.push(targetInbox);
      }
    } else {
      // User actor — resolve from followRelationships table
      const followers = await db
        .select({ followerActorUri: followRelationships.followerActorUri })
        .from(followRelationships)
        .where(
          and(
            eq(followRelationships.followingActorUri, activity.actorUri),
            eq(followRelationships.status, 'accepted'),
          ),
        );

      for (const f of followers) {
        const actor = await db
          .select({ inbox: remoteActors.inbox, sharedInbox: remoteActors.sharedInbox })
          .from(remoteActors)
          .where(eq(remoteActors.actorUri, f.followerActorUri))
          .limit(1);
        const targetInbox = actor[0]?.sharedInbox ?? actor[0]?.inbox;
        if (targetInbox) inboxes.push(targetInbox);
      }

      // Also deliver to instance actor followers (for mirroring)
      // Instance actor URI: https://{domain}/actor
      const instanceActorUri = `https://${domain}/actor`;
      if (activity.actorUri !== instanceActorUri) {
        const instanceFollowers = await db
          .select({ followerActorUri: followRelationships.followerActorUri })
          .from(followRelationships)
          .where(
            and(
              eq(followRelationships.followingActorUri, instanceActorUri),
              eq(followRelationships.status, 'accepted'),
            ),
          );

        for (const f of instanceFollowers) {
          const actor = await db
            .select({ inbox: remoteActors.inbox, sharedInbox: remoteActors.sharedInbox })
            .from(remoteActors)
            .where(eq(remoteActors.actorUri, f.followerActorUri))
            .limit(1);
          const targetInbox = actor[0]?.sharedInbox ?? actor[0]?.inbox;
          if (targetInbox) inboxes.push(targetInbox);
        }
      }
    }
  }

  return [...new Set(inboxes)]; // Deduplicate
}

async function getKeypairForActor(
  db: DB,
  actorUri: string,
  domain: string,
): Promise<{ publicKeyPem: string; privateKeyPem: string } | null> {
  const url = new URL(actorUri);
  const segments = url.pathname.split('/').filter(Boolean);
  const username = segments[segments.length - 1];
  if (!username) return null;

  // Check if this is the instance actor (pattern: /actor)
  if (segments.length === 1 && segments[0] === 'actor') {
    const { getOrCreateInstanceKeypair } = await import('./federation.js');
    return getOrCreateInstanceKeypair(db);
  }

  // Check if this is a hub actor URI (pattern: /hubs/{slug})
  if (segments.includes('hubs') && segments.length >= 2) {
    const hubSlug = segments[segments.indexOf('hubs') + 1];
    if (hubSlug) {
      const [hub] = await db
        .select({ id: hubs.id })
        .from(hubs)
        .where(eq(hubs.slug, hubSlug))
        .limit(1);
      if (hub) {
        // Generate keypair on demand if hub doesn't have one yet
        const { getOrCreateHubKeypair } = await import('./hubFederation.js');
        return getOrCreateHubKeypair(db, hub.id);
      }
    }
    return null;
  }

  // Look up user by username (pattern: /users/{username})
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user[0]) return null;

  // Generate keypair on demand if user doesn't have one yet
  const { getOrCreateActorKeypair } = await import('./federation.js');
  return getOrCreateActorKeypair(db, user[0].id);
}

async function markDelivered(db: DB, activityId: string, error?: string): Promise<void> {
  await db
    .update(activities)
    .set({
      status: 'delivered',
      error: error ?? null,
      attempts: sql`${activities.attempts} + 1`,
      lockedAt: null, // Release lock
    })
    .where(eq(activities.id, activityId));
}

async function markFailed(db: DB, activityId: string, error: string): Promise<void> {
  await db
    .update(activities)
    .set({
      status: 'failed',
      error,
      attempts: sql`${activities.attempts} + 1`,
      lockedAt: null,
      deadLetteredAt: new Date(), // Mark as dead-lettered
    })
    .where(eq(activities.id, activityId));
}

async function incrementAttempts(db: DB, activityId: string, error: string, maxRetries = DEFAULT_MAX_ATTEMPTS): Promise<void> {
  const [row] = await db
    .select({ attempts: activities.attempts })
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);

  const newAttempts = (row?.attempts ?? 0) + 1;
  const isDead = newAttempts >= maxRetries;
  const newStatus = isDead ? 'failed' : 'pending';

  await db
    .update(activities)
    .set({
      status: newStatus,
      error,
      attempts: newAttempts,
      updatedAt: new Date(),
      lockedAt: null, // Release lock
      ...(isDead ? { deadLetteredAt: new Date() } : {}),
    })
    .where(eq(activities.id, activityId));
}

// --- Activity Cleanup ---

/**
 * Delete old activities past the retention period.
 * Cleans up delivered, failed, and dead-lettered activities.
 * Keeps pending activities (still need delivery attempts).
 * Call from a scheduled job (e.g., daily via the delivery worker plugin).
 */
export async function cleanupDeliveredActivities(
  db: DB,
  retentionDays: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(activities)
    .where(
      and(
        or(
          eq(activities.status, 'delivered'),
          eq(activities.status, 'failed'),
          sql`${activities.deadLetteredAt} IS NOT NULL`,
        ),
        lte(activities.createdAt, cutoff),
      ),
    )
    .returning({ id: activities.id });
  return deleted.length;
}
