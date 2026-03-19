import { createVideoCategory } from '@commonpub/server';
import type { VideoCategoryItem } from '@commonpub/server';
import { createVideoCategorySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<VideoCategoryItem> => {
  requireAdmin(event);

  const body = await readBody(event);
  const parsed = createVideoCategorySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }

  const db = useDB();
  return createVideoCategory(db, parsed.data);
});
