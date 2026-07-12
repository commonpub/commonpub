import { deleteHub, getHubIdBySlug } from '@commonpub/server';

export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = requireAuth(event);
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });

  // Real hub id (no read-redaction); deleteHub runs its own auth incl. platform-admin.
  const hub = await getHubIdBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  const deleted = await deleteHub(db, hub.id, user.id, { asPlatformAdmin: hasPermission(event, 'admin.access') });
  if (!deleted) {
    throw createError({ statusCode: 403, statusMessage: 'Not authorized to delete this hub' });
  }
  return { success: true };
});
