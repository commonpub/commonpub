import { createVideoCategory } from '@commonpub/server';
import type { VideoCategoryItem } from '@commonpub/server';
import { createVideoCategorySchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<VideoCategoryItem> => {
  requirePermission(event, 'categories.manage');
  const db = useDB();
  const input = await parseBody(event, createVideoCategorySchema);

  return createVideoCategory(db, input);
});
