import { metricsDaily, contentItems, users } from '@commonpub/schema';
import { and, asc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { DB } from '../types.js';

/**
 * Daily analytics rollups (Phase 3). Aggregate snapshots only — no per-user
 * data, no new PII. Written by the `metrics-rollup` Nitro plugin into
 * `metrics_daily`; read by `getMetricsTimeseries`.
 *
 * Two metric kinds:
 * - `flow` (e.g. `users.new`): that day's count. Deterministic from timestamps,
 *   so fully backfillable and idempotent on re-run.
 * - `cumulative` (e.g. `users.total`, `content.views`): running total as of a
 *   day. Count-based cumulatives are backfilled as the survivorship curve
 *   (currently-live rows by their creation/publish date). Sum-based engagement
 *   cumulatives (views/likes/comments) have no per-day history, so they are
 *   snapshot forward from the first rollup only (never backfilled).
 */

export type MetricKind = 'flow' | 'cumulative';

/** Every metric the timeseries endpoint will serve, with its aggregation kind. */
export const TIMESERIES_METRICS: Record<string, MetricKind> = {
  'users.total': 'cumulative',
  'users.new': 'flow',
  'content.total': 'cumulative',
  'content.new': 'flow',
  'content.views': 'cumulative',
  'content.likes': 'cumulative',
  'content.comments': 'cumulative',
};

const DIM = ''; // global series sentinel (see metrics_daily schema note)

function activeUsersWhere() {
  return and(isNull(users.deletedAt), eq(users.status, 'active'));
}
function publicContentWhere() {
  return and(
    eq(contentItems.status, 'published'),
    eq(contentItems.visibility, 'public'),
    isNull(contentItems.deletedAt),
  );
}

async function upsertRows(
  db: DB,
  rows: Array<{ day: string; metric: string; value: number }>,
): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(metricsDaily)
    .values(rows.map((r) => ({ day: r.day, metric: r.metric, dimension: DIM, value: r.value })))
    .onConflictDoUpdate({
      target: [metricsDaily.day, metricsDaily.metric, metricsDaily.dimension],
      set: { value: sql`excluded.value` },
    });
}

/**
 * Snapshot today's metrics. Count-based + flow metrics are deterministic
 * (`users.total` = currently-live users; `users.new` = created today). Sum-based
 * engagement cumulatives capture the current running total under `today`.
 * Idempotent: re-running for the same day overwrites that day's rows.
 */
export async function runDailyRollup(db: DB, today: string): Promise<void> {
  const [[u], [c]] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        newToday: sql<number>`count(*) FILTER (WHERE ${users.createdAt}::date = ${today})::int`,
      })
      .from(users)
      .where(activeUsersWhere()),
    db
      .select({
        total: sql<number>`count(*)::int`,
        newToday: sql<number>`count(*) FILTER (WHERE ${contentItems.publishedAt}::date = ${today})::int`,
        views: sql<number>`coalesce(sum(${contentItems.viewCount}), 0)::float8`,
        likes: sql<number>`coalesce(sum(${contentItems.likeCount}), 0)::float8`,
        comments: sql<number>`coalesce(sum(${contentItems.commentCount}), 0)::float8`,
      })
      .from(contentItems)
      .where(publicContentWhere()),
  ]);

  await upsertRows(db, [
    { day: today, metric: 'users.total', value: u?.total ?? 0 },
    { day: today, metric: 'users.new', value: u?.newToday ?? 0 },
    { day: today, metric: 'content.total', value: c?.total ?? 0 },
    { day: today, metric: 'content.new', value: c?.newToday ?? 0 },
    { day: today, metric: 'content.views', value: c?.views ?? 0 },
    { day: today, metric: 'content.likes', value: c?.likes ?? 0 },
    { day: today, metric: 'content.comments', value: c?.comments ?? 0 },
  ]);
}

/**
 * Backfill the deterministic count-based series for ALL of history from
 * timestamps: `users.new`/`content.new` (daily flow) and `users.total`/
 * `content.total` (cumulative window-sum = survivorship curve). Sum-based
 * engagement metrics are NOT backfilled (no per-day history exists). Idempotent.
 * Returns the number of rows written.
 */
export async function backfillMetricsDaily(db: DB): Promise<number> {
  const [userDays, contentDays] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${users.createdAt}::date, 'YYYY-MM-DD')`,
        flow: sql<number>`count(*)::int`,
        cumulative: sql<number>`sum(count(*)) OVER (ORDER BY ${users.createdAt}::date)::int`,
      })
      .from(users)
      .where(activeUsersWhere())
      .groupBy(sql`${users.createdAt}::date`)
      .orderBy(sql`${users.createdAt}::date`),
    db
      .select({
        day: sql<string>`to_char(${contentItems.publishedAt}::date, 'YYYY-MM-DD')`,
        flow: sql<number>`count(*)::int`,
        cumulative: sql<number>`sum(count(*)) OVER (ORDER BY ${contentItems.publishedAt}::date)::int`,
      })
      .from(contentItems)
      .where(and(publicContentWhere(), sql`${contentItems.publishedAt} IS NOT NULL`))
      .groupBy(sql`${contentItems.publishedAt}::date`)
      .orderBy(sql`${contentItems.publishedAt}::date`),
  ]);

  const rows: Array<{ day: string; metric: string; value: number }> = [];
  for (const r of userDays) {
    rows.push({ day: r.day, metric: 'users.new', value: r.flow });
    rows.push({ day: r.day, metric: 'users.total', value: r.cumulative });
  }
  for (const r of contentDays) {
    rows.push({ day: r.day, metric: 'content.new', value: r.flow });
    rows.push({ day: r.day, metric: 'content.total', value: r.cumulative });
  }
  await upsertRows(db, rows);
  return rows.length;
}

// --- Timeseries read ---

export type TimeseriesInterval = 'day' | 'week' | 'month';

export interface TimeseriesPoint {
  date: string; // bucket start, YYYY-MM-DD
  value: number;
  delta: number; // change vs the previous bucket
}

export interface MetricsTimeseries {
  metric: string;
  kind: MetricKind;
  interval: TimeseriesInterval;
  from: string;
  to: string;
  since: string | null; // earliest day with data for this metric, or null
  points: TimeseriesPoint[];
}

/** UTC bucket-start key for a YYYY-MM-DD day under the given interval. */
function bucketKey(day: string, interval: TimeseriesInterval): string {
  if (interval === 'day') return day;
  if (interval === 'month') return `${day.slice(0, 7)}-01`;
  // week: Monday of the ISO week (UTC).
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export async function getMetricsTimeseries(
  db: DB,
  opts: { metric: string; interval: TimeseriesInterval; from: string; to: string },
): Promise<MetricsTimeseries> {
  const kind = TIMESERIES_METRICS[opts.metric];
  if (!kind) throw new Error(`Unknown metric: ${opts.metric}`);

  const rows = await db
    .select({ day: metricsDaily.day, value: metricsDaily.value })
    .from(metricsDaily)
    .where(
      and(
        eq(metricsDaily.metric, opts.metric),
        eq(metricsDaily.dimension, DIM),
        gte(metricsDaily.day, opts.from),
        lte(metricsDaily.day, opts.to),
      ),
    )
    .orderBy(asc(metricsDaily.day));

  // Bucket in JS (range is bounded by the caller). flow -> sum within bucket;
  // cumulative -> last value within bucket (the running total at bucket end).
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(r.day, opts.interval);
    const prev = buckets.get(key);
    if (kind === 'flow') buckets.set(key, (prev ?? 0) + r.value);
    else buckets.set(key, r.value); // ordered asc, so last write wins = bucket-end value
  }

  const ordered = [...buckets.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const points: TimeseriesPoint[] = [];
  let prevValue: number | null = null;
  for (const [date, value] of ordered) {
    points.push({ date, value, delta: prevValue === null ? 0 : value - prevValue });
    prevValue = value;
  }

  return {
    metric: opts.metric,
    kind,
    interval: opts.interval,
    from: opts.from,
    to: opts.to,
    since: rows[0]?.day ?? null,
    points,
  };
}
