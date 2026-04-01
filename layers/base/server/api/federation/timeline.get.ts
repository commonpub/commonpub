import { listFederatedTimeline } from '@commonpub/server';
import type { FederatedContentItem } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  apType: z.string().optional(),
  cpubType: z.string().optional(),
  originDomain: z.string().optional(),
});

export default defineEventHandler(
  async (event): Promise<{ items: FederatedContentItem[]; total: number }> => {
    requireFeature('federation');
    const db = useDB();
    const opts = parseQueryParams(event, querySchema);

    return listFederatedTimeline(db, opts);
  },
);
