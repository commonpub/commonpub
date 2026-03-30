import { listHubs } from '@commonpub/server';
import type { HubListItem, FederatedHubListItem } from '@commonpub/server';
import { hubFiltersSchema } from '@commonpub/schema';

export default defineEventHandler(async (event): Promise<{ items: (HubListItem | FederatedHubListItem)[]; total: number }> => {
  const db = useDB();
  const config = useConfig();
  const filters = parseQueryParams(event, hubFiltersSchema);

  const includeFederated = config.features.seamlessFederation && config.features.federateHubs;

  return listHubs(db, filters, { includeFederated });
});
