/**
 * Scheduled-publishing worker.
 * Runs on an interval and publishes any content whose `scheduledAt` time has
 * passed (status='scheduled'). Mirrors the federation-delivery worker: an
 * in-process setInterval started after a short stagger, cleaned up on close.
 *
 * The claim is a single atomic `UPDATE ... RETURNING` inside publishDueScheduled,
 * so this is safe to run on multiple replicas without double-publishing.
 */
import { publishDueScheduled } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  // Sweep cadence. One minute keeps publish latency low without meaningful load
  // (a single indexed UPDATE per tick).
  const INTERVAL_MS = 60_000;

  let interval: ReturnType<typeof setInterval> | null = null;

  const startupTimer = setTimeout(() => {
    try {
      console.log(`[scheduled-publishing] worker started (interval: ${INTERVAL_MS}ms)`);
      runSweep();
      interval = setInterval(runSweep, INTERVAL_MS);
    } catch (err) {
      console.error('[scheduled-publishing] worker failed to start:', err instanceof Error ? err.message : err);
    }
  }, 12_000);

  async function runSweep() {
    try {
      const db = useDB();
      const config = useConfig();
      const published = await publishDueScheduled(db, config);
      if (published > 0) {
        console.log(`[scheduled-publishing] published ${published} scheduled item(s)`);
      }
    } catch (err) {
      console.error('[scheduled-publishing] sweep error:', err instanceof Error ? err.message : err);
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
