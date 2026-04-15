import { deleteHubResource } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing resource ID' });

  const result = await deleteHubResource(db, id, user.id);
  if (!result.success) {
    const status = result.error?.includes('not found') ? 404 : 403;
    throw createError({ statusCode: status, statusMessage: result.error ?? 'Delete failed' });
  }

  return { success: true };
});
