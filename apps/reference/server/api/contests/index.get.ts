import { listContests } from '@commonpub/server';
import type { PaginatedResponse, ContestListItem } from '@commonpub/server';
import { contestFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContestListItem>> => {
  const db = useDB();
  const filters = contestFiltersSchema.parse(getQuery(event));
  return listContests(db, filters);
});
