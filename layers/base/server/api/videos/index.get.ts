import { listVideos, toPageMeta, normalizePagination } from '@commonpub/server';
import type { PaginatedResponse, VideoListItem } from '@commonpub/server';
import { videoFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const filters = parseQueryParams(event, videoFiltersSchema);
  const result = await listVideos(db, filters);
  // The list helper reports COUNT_NOT_COMPUTED past the first page. Translate it
  // here rather than forwarding it: `-1` rendered as "-1 videos" and collapsed
  // the pager's `v-if`, removing Previous as well as Next.
  const { limit, offset } = normalizePagination(filters);
  const page = toPageMeta({ total: result.total, returned: result.items.length, limit, offset });
  return {
    ...result,
    ...page,
    items: result.items.map((v) => ({
      ...v,
      author: {
        username: v.authorUsername,
        displayName: v.authorName,
        avatarUrl: v.authorAvatarUrl,
      },
    })),
  };
});
