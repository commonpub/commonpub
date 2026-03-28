import { activities } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/admin/federation/retry
 * Reset failed activities to pending so the delivery worker retries them.
 * Optionally filter by activity ID.
 *
 * Body: { activityId?: string } — if omitted, retries ALL failed activities
 */
export default defineEventHandler(async (event) => {
  const session = event.context.session;
  if (!session?.user || session.user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' });
  }

  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const body = await readBody(event);
  const activityId = body?.activityId as string | undefined;

  const db = useDB();

  if (activityId) {
    const result = await db
      .update(activities)
      .set({ status: 'pending', attempts: 0, error: null, updatedAt: new Date() })
      .where(and(eq(activities.id, activityId), eq(activities.status, 'failed')))
      .returning({ id: activities.id });

    return { retried: result.length };
  }

  const result = await db
    .update(activities)
    .set({ status: 'pending', attempts: 0, error: null, updatedAt: new Date() })
    .where(eq(activities.status, 'failed'))
    .returning({ id: activities.id });

  return { retried: result.length };
});
