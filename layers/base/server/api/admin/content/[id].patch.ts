import { contentItems } from '@commonpub/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * PATCH /api/admin/content/[id]
 * Update admin-managed content fields (featured, editorial, category).
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const { id: contentId } = parseParams(event, { id: 'uuid' });
  const body = await parseBody(event, z.object({
    isFeatured: z.boolean().optional(),
    isEditorial: z.boolean().optional(),
    editorialNote: z.string().max(255).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
  }));

  const db = useDB();

  const updates: Record<string, unknown> = {};
  if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured;
  if (body.isEditorial !== undefined) updates.isEditorial = body.isEditorial;
  if (body.editorialNote !== undefined) updates.editorialNote = body.editorialNote;
  if (body.categoryId !== undefined) updates.categoryId = body.categoryId;

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' });
  }

  const result = await db
    .update(contentItems)
    .set(updates)
    .where(eq(contentItems.id, contentId))
    .returning({
      id: contentItems.id,
      isFeatured: contentItems.isFeatured,
      isEditorial: contentItems.isEditorial,
      editorialNote: contentItems.editorialNote,
      categoryId: contentItems.categoryId,
    });

  if (result.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Content not found' });
  }

  return result[0];
});
