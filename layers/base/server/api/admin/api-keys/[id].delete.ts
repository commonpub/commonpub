import { revokeApiKey } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  const db = useDB();
  const result = await revokeApiKey(db, id, user.id);
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Key not found or already revoked' });
  return result;
});
