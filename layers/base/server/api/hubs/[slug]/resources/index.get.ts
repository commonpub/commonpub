import { getHubBySlug, listHubResources } from '@commonpub/server';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug } = parseParams(event, { slug: 'string' });

  const hub = await getHubBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }
  requireHubReadAccess(event, hub);

  return listHubResources(db, hub.id);
});
