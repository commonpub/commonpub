import { listVideos } from '@commonpub/server';
import type { PaginatedResponse, VideoListItem } from '@commonpub/server';
import { videoFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<VideoListItem>> => {
  const db = useDB();
  const filters = videoFiltersSchema.parse(getQuery(event));
  return listVideos(db, filters);
});
