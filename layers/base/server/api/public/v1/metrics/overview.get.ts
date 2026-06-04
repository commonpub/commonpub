import { getMetricsOverview } from '@commonpub/server';

/**
 * GET /api/public/v1/metrics/overview
 *
 * Scope: read:analytics. Instance-wide DevRel scorecard: totals (users,
 * contributors, content by type, hubs, tags, engagement) plus 7d/30d growth
 * deltas derived from timestamps. Aggregates only — no per-user data.
 */
export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:analytics');
  const db = useDB();
  const config = useConfig();
  return await getMetricsOverview(db, config.instance.domain);
});
