import { getTrendingTags } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/public/v1/metrics/tags/trending
 *
 * Scope: read:analytics. Tags ranked by lifetime usage count (unused tags
 * excluded). Time-windowed trending arrives with Phase 3 rollups.
 */
export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:analytics');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const db = useDB();
  const config = useConfig();
  const items = await getTrendingTags(db, config.instance.domain, parsed.data.limit);
  return { items, limit: parsed.data.limit };
});
