import { listVideos } from '@commonpub/server';
import type { PaginatedResponse, VideoListItem } from '@commonpub/server';
import { videoFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<VideoListItem>> => {
  const db = useDB();
  const filters = parseQueryParams(event, videoFiltersSchema);
  return listVideos(db, filters);
});
