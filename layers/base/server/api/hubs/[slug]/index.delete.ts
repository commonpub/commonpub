import { deleteHub, getHubBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug, user.id);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const deleted = await deleteHub(db, hub.id, user.id);
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to delete this hub' });
  }
  return { success: true };
});
