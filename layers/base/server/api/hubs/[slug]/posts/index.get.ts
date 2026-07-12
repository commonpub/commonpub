import { listPosts, getHubBySlug } from '@commonpub/server';
import type { PaginatedResponse, HubPostItem } from '@commonpub/server';
import { hubPostFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<HubPostItem>> => {
  const db = useDB();
  const user = getOptionalUser(event);
  const { slug } = parseParams(event, { slug: 'string' });
  const filters = parseQueryParams(event, hubPostFiltersSchema);

  const hub = await getHubBySlug(db, slug, user?.id, {
    asPlatformAdmin: hasPermission(event, 'admin.access'),
  });
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }
  requireHubReadAccess(event, hub);

  return listPosts(db, hub.id, filters);
});
