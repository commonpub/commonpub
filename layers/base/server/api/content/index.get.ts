import { listContent, toPageMeta, normalizePagination } from '@commonpub/server';
import type { PaginatedPage, ContentListItem } from '@commonpub/server';
import { contentFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedPage<ContentListItem>> => {
  const db = useDB();
  const rawFilters = parseQueryParams(event, contentFiltersSchema);
  // Shared auth/status/visibility/federation gate (also used by the keyset feed endpoint).
  const { filters, options } = resolveContentQuery(event, rawFilters);
  const result = await listContent(db, filters, options);
  // listContent skips COUNT(*) past page 1 whenever the federated merge is
  // bypassed, which any of authorId/featured/editorial/categoryId/difficulty/tag
  // does. Forwarding its sentinel put `total: -1` on this route.
  const { limit, offset } = normalizePagination(filters);
  return { ...result, ...toPageMeta({ total: result.total, returned: result.items.length, limit, offset }) };
});
