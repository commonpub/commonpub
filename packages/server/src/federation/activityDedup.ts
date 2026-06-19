/**
 * Inbox replay dedup (audit session 204).
 *
 * Federated inbox handlers carry side effects (reply commentCount + 1, onAccept
 * backfill, like counters). A remote instance — or an attacker replaying a
 * captured, validly-signed activity — could redeliver the same `activity.id`
 * and double-apply those effects. We record each processed activity id in the
 * `processed_activities` table and short-circuit on the second delivery.
 *
 * `recordActivitySeen` MUST be called only AFTER signature verification + actor
 * binding succeed, so an unverified caller can't seed the table with attacker-
 * chosen ids (which would let them suppress a future legitimate activity).
 */
import { processedActivities } from '@commonpub/schema';
import type { DB } from '../types.js';

/**
 * Atomically claim an activity id as "processed".
 *
 * Returns `true` if this call inserted the row (first time this id is seen —
 * the caller SHOULD process the activity), or `false` if the id was already
 * present (a replay — the caller SHOULD short-circuit without re-dispatching).
 *
 * Uses `INSERT ... ON CONFLICT DO NOTHING RETURNING` so the claim is a single
 * atomic statement: concurrent deliveries of the same id race on the primary
 * key and exactly one wins the insert.
 */
export async function recordActivitySeen(db: DB, activityId: string): Promise<boolean> {
  const inserted = await db
    .insert(processedActivities)
    .values({ activityId })
    .onConflictDoNothing({ target: processedActivities.activityId })
    .returning({ activityId: processedActivities.activityId });
  return inserted.length > 0;
}
