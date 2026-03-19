import { listUserBookmarks } from '@commonpub/server';
import type { PaginatedResponse, BookmarkItem } from '@commonpub/server';
import { z } from 'zod';

const bookmarksQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export default defineEventHandler(async (event): Promise<PaginatedResponse<BookmarkItem>> => {
  const user = requireAuth(event);
  const db = useDB();
  const query = bookmarksQuerySchema.parse(getQuery(event));

  return listUserBookmarks(db, user.id, query);
});
