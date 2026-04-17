import { listPaths } from '@commonpub/server';
import type { PaginatedResponse, LearningPathListItem } from '@commonpub/server';
import { learningPathFiltersSchema } from '@commonpub/schema';

// Statuses a non-owner may request. The old behavior passed filters.status
// through verbatim, so /api/learn?status=draft leaked every author's drafts.
const PUBLIC_STATUSES = new Set(['published', 'archived']);

export default defineEventHandler(async (event): Promise<PaginatedResponse<LearningPathListItem>> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const filters = parseQueryParams(event, learningPathFiltersSchema);

  // Allow author to see their own drafts (same pattern as content API)
  const isOwnContent = filters.authorId && user?.id === filters.authorId;

  const resolvedStatus = isOwnContent
    ? filters.status
    : (filters.status && PUBLIC_STATUSES.has(filters.status) ? filters.status : 'published');

  return listPaths(db, {
    ...filters,
    status: resolvedStatus,
  });
});
