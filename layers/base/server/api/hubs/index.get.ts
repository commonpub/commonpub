import { listHubs } from '@commonpub/server';
import type { HubListItem, FederatedHubListItem } from '@commonpub/server';
import { hubFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ items: (HubListItem | FederatedHubListItem)[]; total: number }> => {
  const db = useDB();
  const config = useConfig();
  const filters = parseQueryParams(event, hubFiltersSchema);

  // seamlessFederation controls display of mirrored content (including hubs from other instances)
  // federateHubs controls outbound hub federation (sending our hubs) — not needed for display
  const includeFederated = !!config.features.seamlessFederation;

  return listHubs(db, filters, { includeFederated });
});
