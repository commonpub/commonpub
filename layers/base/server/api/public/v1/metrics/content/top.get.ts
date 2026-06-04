import { getTopContent } from '@commonpub/server';
import { z } from 'zod';

const querySchema = z.object({
  metric: z.enum(['views', 'likes', 'comments']).default('views'),
  type: z.enum(['project', 'blog', 'explainer']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * GET /api/public/v1/metrics/content/top
 *
 * Scope: read:analytics. Leaderboard of published, public content by the chosen
 * engagement metric. Author attribution is intentional (the content is public).
 */
export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:analytics');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const db = useDB();
  const config = useConfig();
  const items = await getTopContent(db, config.instance.domain, {
    metric: parsed.data.metric,
    type: parsed.data.type,
    limit: parsed.data.limit,
  });
  return { items, metric: parsed.data.metric, limit: parsed.data.limit };
});
