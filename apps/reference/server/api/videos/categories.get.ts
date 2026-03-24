import { listVideoCategories } from '@commonpub/server';
import type { VideoCategoryItem } from '@commonpub/server';

export default defineEventHandler(async (_event): Promise<VideoCategoryItem[]> => {
  const db = useDB();
  return listVideoCategories(db);
});
