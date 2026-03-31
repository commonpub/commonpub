import { updateVideoCategory } from '@commonpub/server';
import type { VideoCategoryItem } from '@commonpub/server';
import { createVideoCategorySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<VideoCategoryItem> => {
  requireAdmin(event);
  const { id } = parseParams(event, { id: 'uuid' });
  const input = await parseBody(event, createVideoCategorySchema.partial());

  const db = useDB();
  const result = await updateVideoCategory(db, id, input);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  }

  return result;
});
