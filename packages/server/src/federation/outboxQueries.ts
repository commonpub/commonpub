/**
 * Outbox queries — serve paginated outbound activities for AP actor outboxes.
 * Used by /actor/outbox (instance) and /users/[username]/outbox (per-user) routes.
 */
import { eq, and, sql, desc } from 'drizzle-orm';
import { activities } from '@commonpub/schema';
import type { DB } from '../types.js';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Count total outbox items for an actor.
 * Only counts delivered outbound Create/Update/Delete activities.
 */
export async function countOutboxItems(db: DB, actorUri: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .where(
      and(
        eq(activities.actorUri, actorUri),
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'delivered'),
        sql`${activities.type} IN ('Create', 'Update', 'Delete')`,
      ),
    );
  return result?.count ?? 0;
}

/**
 * Count total outbox items for the instance actor (all users' delivered Create activities).
 */
export async function countInstanceOutboxItems(db: DB, domain: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .where(
      and(
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'delivered'),
        eq(activities.type, 'Create'),
        sql`${activities.actorUri} LIKE ${'https://' + domain + '/users/%'}`,
      ),
    );
  return result?.count ?? 0;
}

/**
 * Get a page of outbox activities for a specific actor.
 * Returns the full activity payload (AP JSON-LD) for each item.
 */
export async function getOutboxPage(
  db: DB,
  actorUri: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Record<string, unknown>[]> {
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select({ payload: activities.payload })
    .from(activities)
    .where(
      and(
        eq(activities.actorUri, actorUri),
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'delivered'),
        sql`${activities.type} IN ('Create', 'Update', 'Delete')`,
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(pageSize)
    .offset(offset);

  return rows.map((r) => r.payload as Record<string, unknown>);
}

/**
 * Get a page of instance-level outbox activities (all users' Create activities).
 * Used by the instance actor outbox for backfill.
 */
export async function getInstanceOutboxPage(
  db: DB,
  domain: string,
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<Record<string, unknown>[]> {
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select({ payload: activities.payload })
    .from(activities)
    .where(
      and(
        eq(activities.direction, 'outbound'),
        eq(activities.status, 'delivered'),
        eq(activities.type, 'Create'),
        sql`${activities.actorUri} LIKE ${'https://' + domain + '/users/%'}`,
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(pageSize)
    .offset(offset);

  return rows.map((r) => r.payload as Record<string, unknown>);
}
