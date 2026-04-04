import { searchFederatedContent } from '@commonpub/server';
import { z } from 'zod';

const schema = z.object({
  q: z.string().max(200),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Server-side federated content search using Postgres FTS.
 * Replaces the client-side filtering on /api/federation/timeline.
 */
export default defineEventHandler(async (event) => {
  requireFeature('federation');
  const db = useDB();
  const { q, limit, offset } = parseQueryParams(event, schema);

  return searchFederatedContent(db, q, { limit, offset });
});
