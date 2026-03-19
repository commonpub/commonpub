import { listPaths } from '@commonpub/server';
import type { PaginatedResponse, LearningPathListItem } from '@commonpub/server';
import { learningPathFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<LearningPathListItem>> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const filters = parseQueryParams(event, learningPathFiltersSchema);

  // Allow author to see their own drafts (same pattern as content API)
  const isOwnContent = filters.authorId && user?.id === filters.authorId;

  return listPaths(db, {
    ...filters,
    status: isOwnContent ? filters.status : (filters.status ?? 'published'),
  });
});
