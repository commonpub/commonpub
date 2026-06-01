import { listContent } from '@commonpub/server';
import type { PaginatedResponse, ContentListItem } from '@commonpub/server';
import { contentFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContentListItem>> => {
  const db = useDB();
  const rawFilters = parseQueryParams(event, contentFiltersSchema);
  // Shared auth/status/visibility/federation gate (also used by the keyset feed endpoint).
  const { filters, options } = resolveContentQuery(event, rawFilters);
  return listContent(db, filters, options);
});
