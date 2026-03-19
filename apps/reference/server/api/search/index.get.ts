import { listContent } from '@commonpub/server';
import type { PaginatedResponse, ContentListItem } from '@commonpub/server';
import { contentFiltersSchema } from '@commonpub/schema';
import { z } from 'zod';

const searchQuerySchema = contentFiltersSchema.extend({
  q: z.string().max(200).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContentListItem>> => {
  const db = useDB();
  const filters = parseQueryParams(event, searchQuerySchema);
  const q = filters.q || filters.search;

  if (!q) {
    return { items: [], total: 0 };
  }

  return listContent(db, {
    ...filters,
    status: 'published',
    search: q,
  });
});
