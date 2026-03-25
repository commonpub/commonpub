import { sql, eq } from 'drizzle-orm';
import { activities, followRelationships } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();

  const [inbound, outbound, pending, failed, followers, following] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(activities).where(eq(activities.direction, 'inbound')),
    db.select({ count: sql<number>`count(*)::int` }).from(activities).where(eq(activities.direction, 'outbound')),
    db.select({ count: sql<number>`count(*)::int` }).from(activities).where(eq(activities.status, 'pending')),
    db.select({ count: sql<number>`count(*)::int` }).from(activities).where(eq(activities.status, 'failed')),
    db.select({ count: sql<number>`count(*)::int` }).from(followRelationships).where(eq(followRelationships.status, 'accepted')),
    db.select({ count: sql<number>`count(*)::int` }).from(followRelationships),
  ]);

  return {
    inbound: inbound[0]?.count ?? 0,
    outbound: outbound[0]?.count ?? 0,
    pending: pending[0]?.count ?? 0,
    failed: failed[0]?.count ?? 0,
    followers: followers[0]?.count ?? 0,
    following: following[0]?.count ?? 0,
  };
});
