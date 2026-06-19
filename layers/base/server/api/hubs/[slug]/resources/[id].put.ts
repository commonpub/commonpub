import { updateHubResource } from '@commonpub/server';
import { updateHubResourceSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { id } = parseParams(event, { id: 'uuid' });

  const input = await parseBody(event, updateHubResourceSchema);

  try {
    return await updateHubResource(db, id, user.id, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message.includes('not found')) throw createError({ statusCode: 404, statusMessage: message });
    if (message.includes('permissions')) throw createError({ statusCode: 403, statusMessage: message });
    throw createError({ statusCode: 500, statusMessage: message });
  }
});
