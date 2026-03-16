import { getVideoById, incrementVideoViewCount } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, message: 'ID required' });
  const video = await getVideoById(db, id);
  if (!video) throw createError({ statusCode: 404, message: 'Video not found' });
  await incrementVideoViewCount(db, id);
  return video;
});
