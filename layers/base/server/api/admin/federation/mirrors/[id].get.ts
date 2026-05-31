import { getMirror } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  requireFeature('federation');
  requirePermission(event, 'federation.manage');
  const db = useDB();
  const { id } = parseParams(event, { id: 'uuid' });

  const mirror = await getMirror(db, id);
  if (!mirror) {
    throw createError({ statusCode: 404, statusMessage: 'Mirror not found' });
  }

  return mirror;
});
