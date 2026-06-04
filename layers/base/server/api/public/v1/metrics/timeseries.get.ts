import { getMetricsTimeseries, TIMESERIES_METRICS } from '@commonpub/server';
import { z } from 'zod';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const querySchema = z.object({
  metric: z.enum(Object.keys(TIMESERIES_METRICS) as [string, ...string[]]),
  interval: z.enum(['day', 'week', 'month']).default('day'),
  from: z.string().regex(DAY).optional(),
  to: z.string().regex(DAY).optional(),
});

/**
 * GET /api/public/v1/metrics/timeseries
 *
 * Scope: read:analytics. Daily time-series from the `metrics_daily` rollups.
 * `metric` is one of the registered series (users.total/new, content.total/new/
 * views/likes/comments); `interval` buckets day|week|month. Defaults to the last
 * 90 days. Engagement (views/likes/comments) series begin at the first rollup,
 * surfaced via `since`.
 */
export default defineEventHandler(async (event) => {
  requireApiScope(event, 'read:analytics');
  const parsed = querySchema.safeParse(getQuery(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid query parameters', data: parsed.error.flatten() });
  }
  const { metric, interval } = parsed.data;

  // Default to the last 90 days; clamp the span to 2 years to bound the scan.
  const todayMs = Date.now();
  const to = parsed.data.to ?? new Date(todayMs).toISOString().slice(0, 10);
  let from = parsed.data.from ?? new Date(todayMs - 90 * DAY_MS).toISOString().slice(0, 10);
  if (from > to) from = to;
  const minFrom = new Date(new Date(`${to}T00:00:00Z`).getTime() - 730 * DAY_MS).toISOString().slice(0, 10);
  if (from < minFrom) from = minFrom;

  const db = useDB();
  return await getMetricsTimeseries(db, { metric, interval, from, to });
});
