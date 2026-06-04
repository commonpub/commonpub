import { pgTable, uuid, varchar, date, bigint, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Daily analytics rollups for the public API (Phase 3 time-series).
 *
 * One row per (day, metric, dimension). Rows are aggregate snapshots only — no
 * per-user data, no new PII — written by the `metrics-rollup` Nitro plugin and
 * read by `GET /api/public/v1/metrics/timeseries`.
 *
 * Metric families:
 * - Cumulative snapshots (e.g. `users.total`, `content.views`): the running
 *   total as of that day. Count-based ones are backfillable from timestamps;
 *   sum-based engagement counters start accumulating from the first rollup.
 * - Flow metrics (e.g. `users.new`, `content.new`): that day's count, fully
 *   backfillable from `created_at` / `published_at`.
 *
 * `dimension` is NOT NULL with `''` meaning "no dimension" (the global series).
 * Using `''` instead of NULL keeps the unique index well-behaved — NULLs are
 * distinct in a Postgres unique index, which would silently allow duplicate
 * global rows and break the rollup's idempotent upsert.
 */
export const metricsDaily = pgTable(
  'metrics_daily',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    day: date('day').notNull(),
    metric: varchar('metric', { length: 64 }).notNull(),
    dimension: varchar('dimension', { length: 64 }).notNull().default(''),
    value: bigint('value', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_metrics_daily_day_metric_dim').on(t.day, t.metric, t.dimension),
    index('idx_metrics_daily_metric_day').on(t.metric, t.day),
  ],
);

export type MetricsDailyRow = typeof metricsDaily.$inferSelect;
export type NewMetricsDailyRow = typeof metricsDaily.$inferInsert;
