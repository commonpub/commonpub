import { eq, and, desc } from 'drizzle-orm';
import { activities } from '@commonpub/schema';

/**
 * GET /api/admin/federation/pending
 * Lists pending outbound activities for diagnostic purposes.
 * Helps debug delivery issues (stuck Delete activities, etc.)
 */
export default defineEventHandler(async (event) => {
  requireFeature('admin');
  requireAdmin(event);
  const db = useDB();

  const pending = await db
    .select()
    .from(activities)
    .where(and(eq(activities.direction, 'outbound'), eq(activities.status, 'pending')))
    .orderBy(desc(activities.createdAt))
    .limit(50);

  return { count: pending.length, activities: pending };
});
