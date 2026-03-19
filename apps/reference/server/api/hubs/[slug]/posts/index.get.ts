import { listPosts, getHubBySlug } from '@commonpub/server';
import type { PaginatedResponse, HubPostItem } from '@commonpub/server';
import { hubPostFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<HubPostItem>> => {
  const db = useDB();
  const { slug } = parseParams(event, { slug: 'string' });
  const filters = parseQueryParams(event, hubPostFiltersSchema);

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return listPosts(db, hub.id, filters);
});
