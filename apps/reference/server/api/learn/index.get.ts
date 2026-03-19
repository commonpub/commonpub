import { listPaths } from '@commonpub/server';
import type { PaginatedResponse, LearningPathListItem } from '@commonpub/server';
import { learningPathFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<LearningPathListItem>> => {
  const db = useDB();
  const filters = learningPathFiltersSchema.parse(getQuery(event));

  return listPaths(db, {
    ...filters,
    status: filters.status ?? 'published',
  });
});
