import { getTopContributors } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/public/v1/metrics/contributors/top
 *
 * Scope: read:analytics. Ranks public-profile, active users by their published,
 * public content (with engagement received). Private/suspended/deleted profiles
 * are excluded; this aggregates already-public attribution.
 */
export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:analytics');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const db = useDB();
  const config = useConfig();
  const items = await getTopContributors(db, config.instance.domain, parsed.data.limit);
  return { items, limit: parsed.data.limit };
});
