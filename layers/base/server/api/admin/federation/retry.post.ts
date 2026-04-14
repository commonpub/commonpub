import { activities } from '@commonpub/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const retrySchema = z.object({
  activityId: z.string().uuid().optional(),
});

/**
 * POST /api/admin/federation/retry
 * Reset failed activities to pending so the delivery worker retries them.
 * Optionally filter by activity ID.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const body = await parseBody(event, retrySchema);
  const activityId = body.activityId;

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
