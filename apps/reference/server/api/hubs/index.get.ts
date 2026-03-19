import { listHubs } from '@commonpub/server';
import type { PaginatedResponse, HubListItem } from '@commonpub/server';
import { hubFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<HubListItem>> => {
  const db = useDB();
  const filters = parseQueryParams(event, hubFiltersSchema);

  return listHubs(db, filters);
});
