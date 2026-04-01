import { listVideos } from '@commonpub/server';
import type { PaginatedResponse, VideoListItem } from '@commonpub/server';
import { videoFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const filters = parseQueryParams(event, videoFiltersSchema);
  const result = await listVideos(db, filters);
  return {
    ...result,
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
