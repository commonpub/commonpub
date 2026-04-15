import { getHubBySlug, reorderHubResources } from '@commonpub/server';
import { reorderHubResourcesSchema } from '@commonpub/schema';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = requireAuth(event);
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const input = await parseBody(event, reorderHubResourcesSchema);
  const result = await reorderHubResources(db, hub.id, user.id, input.ids);

  if (!result.success) {
    throw createError({ statusCode: 403, statusMessage: result.error ?? 'Reorder failed' });
  }

  return { success: true };
});
