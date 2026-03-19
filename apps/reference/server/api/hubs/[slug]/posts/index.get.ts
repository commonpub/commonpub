import { listPosts, getHubBySlug } from '@commonpub/server';
import type { PaginatedResponse, HubPostItem } from '@commonpub/server';
import { hubPostFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<HubPostItem>> => {
  const db = useDB();
  const slug = getRouterParam(event, 'slug')!;
  const filters = hubPostFiltersSchema.parse(getQuery(event));

  const hub = await getHubBySlug(db, slug);
  if (!hub) {
    throw createError({ statusCode: 404, statusMessage: 'Hub not found' });
  }

  return listPosts(db, hub.id, filters);
});
