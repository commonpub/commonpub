/**
 * Daily analytics rollup worker (Phase 3).
 *
 * When `features.publicApi` is on, snapshots aggregate metrics into
 * `metrics_daily` so `GET /api/public/v1/metrics/timeseries` has history. On the
 * first ever run (empty table) it backfills the deterministic count-based series
 * from timestamps. Runs are idempotent (upsert per day), so the periodic
 * interval just refreshes today's row. Aggregates only — no per-user data.
 */
import { runDailyRollup, backfillMetricsDaily } from '@commonpub/server';
import { metricsDaily } from '@commonpub/schema';

const ROLLUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6h; refreshes today's snapshot

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;

  const startupTimer = setTimeout(() => {
    try {
      const config = useConfig();
      if (!config.features.publicApi) return; // no public API ⇒ no rollups needed
      console.log(`[metrics-rollup] worker started (interval: ${ROLLUP_INTERVAL_MS}ms)`);
      runRollup();
      interval = setInterval(runRollup, ROLLUP_INTERVAL_MS);
    } catch (err) {
      console.error('[metrics-rollup] failed to start:', err instanceof Error ? err.message : err);
    }
  }, 15_000); // stagger after federation/registry workers

  async function runRollup(): Promise<void> {
    try {
      const db = useDB();
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
      const [existing] = await db.select({ id: metricsDaily.id }).from(metricsDaily).limit(1);
      if (!existing) {
        const n = await backfillMetricsDaily(db);
        console.log(`[metrics-rollup] backfilled ${n} historical rows`);
      }
      await runDailyRollup(db, today);
    } catch (err) {
      console.error('[metrics-rollup] run error:', err instanceof Error ? err.message : err);
    }
  }

  nitro.hooks.hook('close', () => {
    clearTimeout(startupTimer);
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  });
});
