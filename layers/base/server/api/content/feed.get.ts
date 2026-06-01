import { listContentKeyset } from '@commonpub/server';
import type { ContentListItem } from '@commonpub/server';
import { contentFiltersSchema } from '@commonpub/schema';

/**
 * Keyset (cursor) pagination for the chronological content feed — the scalable
 * infinite-scroll endpoint (O(limit) per page, no COUNT, no offset window).
 *
 * Separate from the offset `GET /api/content` (which stays for numbered/admin listing
 * and for `total`); both share `resolveContentQuery` so the auth/status/visibility/
 * federation gate can't drift between them. Order is fixed to recency — popular/
 * featured/editorial sorts and `offset` are not meaningful here and are ignored.
 *
 * Request:  GET /api/content/feed?type=blog&limit=20[&cursor=<opaque>]
 * Response: { items, nextCursor }  (nextCursor null when the feed is exhausted)
 */
export default defineEventHandler(async (event): Promise<{ items: ContentListItem[]; nextCursor: string | null }> => {
  const db = useDB();
  const rawFilters = parseQueryParams(event, contentFiltersSchema);
  const { filters, options } = resolveContentQuery(event, rawFilters);
  return listContentKeyset(db, filters, options);
});
