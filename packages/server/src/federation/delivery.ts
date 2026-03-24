/**
 * Activity delivery — sends pending outbound AP activities to remote inboxes.
 * Signs requests with HTTP Signatures and updates delivery status.
 */
import { eq, and, sql, lte } from 'drizzle-orm';
import { activities, remoteActors, followRelationships, actorKeypairs, users } from '@commonpub/schema';
import { signRequest } from '@commonpub/protocol';
import type { DB } from '../types.js';

const MAX_ATTEMPTS = 5;
const CONTENT_TYPE_AP = 'application/activity+json';

export interface DeliveryResult {
  delivered: number;
  failed: number;
  errors: string[];
}

/**
 * Process and deliver pending outbound activities.
 * Call this from a background worker or cron job.
 *
 * @param db - Database connection
 * @param domain - The local instance domain
 * @param batchSize - Max activities to process per run (default 20)
 */
export async function deliverPendingActivities(
  db: DB,
  domain: string,
  batchSize = 20,
): Promise<DeliveryResult> {
  const result: DeliveryResult = { delivered: 0, failed: 0, errors: [] };

  // Fetch pending outbound activities
  const pending = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'pending'),
        lte(activities.attempts, MAX_ATTEMPTS),
      ),
    )
    .orderBy(activities.createdAt)
    .limit(batchSize);

  for (const activity of pending) {
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

  // Deliver to each inbox
  const errors: string[] = [];
  for (const inbox of targetInboxes) {
    try {
      const request = new Request(inbox, {
        method: 'POST',
        headers: {
          'Content-Type': CONTENT_TYPE_AP,
          'Accept': CONTENT_TYPE_AP,
        },
        body,
      });

      const signed = await signRequest(request, keypair.privateKeyPem, keyId);
      const response = await fetch(signed);

      if (!response.ok && response.status !== 202) {
        errors.push(`${inbox}: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      errors.push(`${inbox}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length === 0) {
    await markDelivered(db, activity.id);
  } else if (errors.length < targetInboxes.length) {
    // Partial delivery — still mark delivered but log errors
    await markDelivered(db, activity.id, errors.join('; '));
  } else {
    // All failed
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
  } else if (type === 'Follow' || type === 'Undo') {
    // Send to the target actor's inbox
    const targetActorUri = activity.objectUri;
    if (targetActorUri) {
      const actor = await db
        .select({ inbox: remoteActors.inbox })
        .from(remoteActors)
        .where(eq(remoteActors.actorUri, targetActorUri))
        .limit(1);
      if (actor[0]?.inbox) inboxes.push(actor[0].inbox);
    }
  } else if (type === 'Create' || type === 'Update' || type === 'Delete' || type === 'Like' || type === 'Announce') {
    // Send to all accepted followers' inboxes
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
        .select({ inbox: remoteActors.inbox })
        .from(remoteActors)
        .where(eq(remoteActors.actorUri, f.followerActorUri))
        .limit(1);
      if (actor[0]?.inbox) inboxes.push(actor[0].inbox);
    }
  }

  return [...new Set(inboxes)]; // Deduplicate
}

async function getKeypairForActor(
  db: DB,
  actorUri: string,
  domain: string,
): Promise<{ publicKeyPem: string; privateKeyPem: string } | null> {
  // Extract username from actorUri: https://domain/users/username
  const url = new URL(actorUri);
  const segments = url.pathname.split('/').filter(Boolean);
  const username = segments[segments.length - 1];
  if (!username) return null;

  // Look up user by username
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user[0]) return null;

  const keypair = await db
    .select()
    .from(actorKeypairs)
    .where(eq(actorKeypairs.userId, user[0].id))
    .limit(1);

  if (!keypair[0]) return null;

  return {
    publicKeyPem: keypair[0].publicKeyPem,
    privateKeyPem: keypair[0].privateKeyPem,
  };
}

async function markDelivered(db: DB, activityId: string, error?: string): Promise<void> {
  await db
    .update(activities)
    .set({
      status: 'delivered',
      error: error ?? null,
      attempts: sql`${activities.attempts} + 1`,
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
    })
    .where(eq(activities.id, activityId));
}

async function incrementAttempts(db: DB, activityId: string, error: string): Promise<void> {
  const [row] = await db
    .select({ attempts: activities.attempts })
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);

  const newAttempts = (row?.attempts ?? 0) + 1;
  const newStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

  await db
    .update(activities)
    .set({
      status: newStatus,
      error,
      attempts: newAttempts,
    })
    .where(eq(activities.id, activityId));
}
