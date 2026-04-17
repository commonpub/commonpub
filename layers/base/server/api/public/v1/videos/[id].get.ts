import { getVideoById, toPublicVideo, isPublicVideo, type PublicVideoRow } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:videos');
  requireFeature('video');
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id format' });
  }
  const db = useDB();
  const config = useConfig();
  const row = await getVideoById(db, id);
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Video not found' });
  const casted = row as unknown as PublicVideoRow;
  if (!isPublicVideo(casted)) throw createError({ statusCode: 404, statusMessage: 'Video not found' });
  return toPublicVideo(casted, config.instance.domain);
});
