import { listHubs } from '@commonpub/server';
import type { PaginatedResponse, HubListItem } from '@commonpub/server';
import { hubFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<HubListItem>> => {
  const db = useDB();
  const filters = hubFiltersSchema.parse(getQuery(event));

  return listHubs(db, filters);
});
