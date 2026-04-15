import { contentItems } from '@commonpub/schema';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

/**
 * POST /api/admin/content/bulk-editorial
 * Bulk update editorial status on multiple content items (admin only).
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const body = await parseBody(event, z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    isEditorial: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    categoryId: z.string().uuid().optional().nullable(),
  }));

  const db = useDB();

  const updates: Record<string, unknown> = {};
  if (body.isEditorial !== undefined) updates.isEditorial = body.isEditorial;
  if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured;
  if (body.categoryId !== undefined) updates.categoryId = body.categoryId;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const result = await db
    .update(contentItems)
    .set(updates)
    .where(inArray(contentItems.id, body.ids))
    .returning({ id: contentItems.id });

  return { updated: result.length };
});
