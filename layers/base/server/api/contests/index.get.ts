import { listContests } from '@commonpub/server';
import type { PaginatedResponse, ContestListItem } from '@commonpub/server';
import { contestFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<PaginatedResponse<ContestListItem>> => {
  requireFeature('contests');
  const db = useDB();
  const filters = parseQueryParams(event, contestFiltersSchema);
  // Pass the viewer so the list can include their own drafts/hidden contests
  // (and everything for admins) while keeping the public list public-only.
  const user = getOptionalUser(event);
  return listContests(db, filters, user ? { userId: user.id, role: user.role } : null);
});
