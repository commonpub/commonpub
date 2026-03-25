import { listContent } from '@commonpub/server';
import type { PaginatedResponse, ContentListItem } from '@commonpub/server';
import { contentFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContentListItem>> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const filters = parseQueryParams(event, contentFiltersSchema);

  const isOwnContent = filters.authorId && user?.id === filters.authorId;

  return listContent(db, {
    ...filters,
    status: isOwnContent ? filters.status : (filters.status ?? 'published'),
    // Only show public content unless viewing own content
    visibility: isOwnContent ? filters.visibility : 'public',
  });
});
