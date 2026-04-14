import { contentItems } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * PATCH /api/admin/content/[id]
 * Update admin-managed content fields (featured status, visibility).
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const { id: contentId } = parseParams(event, { id: 'uuid' });
  const body = await parseBody(event, z.object({
    isFeatured: z.boolean().optional(),
  }));

  const db = useDB();

  const updates: Record<string, unknown> = {};
  if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const result = await db
    .update(contentItems)
    .set(updates)
    .where(eq(contentItems.id, contentId))
    .returning({ id: contentItems.id, isFeatured: contentItems.isFeatured });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }

  return result[0];
});
