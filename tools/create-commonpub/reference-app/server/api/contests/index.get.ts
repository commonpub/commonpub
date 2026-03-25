import { listContests } from '@commonpub/server';
import type { PaginatedResponse, ContestListItem } from '@commonpub/server';
import { contestFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContestListItem>> => {
  requireFeature('contests');
  const db = useDB();
  const filters = parseQueryParams(event, contestFiltersSchema);
  return listContests(db, filters);
});
