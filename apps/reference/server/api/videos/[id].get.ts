import { getVideoById, incrementVideoViewCount } from '@commonpub/server';
import type { VideoDetail } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<VideoDetail> => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID required' });
  const video = await getVideoById(db, id);
  if (!video) throw createError({ statusCode: 404, statusMessage: 'Video not found' });
  await incrementVideoViewCount(db, id);
  return video;
});
