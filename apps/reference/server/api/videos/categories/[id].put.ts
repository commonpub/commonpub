import { updateVideoCategory } from '@commonpub/server';
import type { VideoCategoryItem } from '@commonpub/server';
import { createVideoCategorySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<VideoCategoryItem> => {
  requireAdmin(event);

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Category ID required' });
  }

  const body = await readBody(event);
  const parsed = createVideoCategorySchema.partial().safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }

  const db = useDB();
  const result = await updateVideoCategory(db, id, parsed.data);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' });
  }

  return result;
});
