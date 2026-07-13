/**
 * Contest deadline-reminder worker.
 * Runs on an interval and enqueues deadline reminder emails to REGISTERED
 * participants at each milestone (7d / 48h / 24h / 1h before a contest's
 * deadline). Mirrors the scheduled-publishing worker: an in-process setInterval
 * started after a short stagger, cleaned up on close.
 *
 * sweepContestReminders claims each (contest, participant, milestone) via a
 * single `INSERT ... ON CONFLICT DO NOTHING RETURNING` ledger row, so this is
 * safe to run on multiple replicas without double-sending. It is gated INSIDE
 * the sweep on BOTH `emailNotifications` (the outbox worker only drains when it
 * is on) AND `contestReminders`, so it stays inert until an operator opts in.
 */
import { sweepContestReminders } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  // Sweep cadence. Ten minutes keeps reminder latency well inside the tightest
  // (1-hour) milestone window while adding negligible load (one indexed contest
  // scan per tick, then a claim only for deadlines actually in a window).
  const INTERVAL_MS = 600_000;

  let interval: ReturnType<typeof setInterval> | null = null;
  // Re-entrancy guard: a slow sweep must not overlap the next tick.
  let running = false;

  const startupTimer = setTimeout(() => {
    try {
      console.log(`[contest-reminders] worker started (interval: ${INTERVAL_MS}ms)`);
      void runSweep();
      interval = setInterval(() => void runSweep(), INTERVAL_MS);
    } catch (err) {
      console.error('[contest-reminders] worker failed to start:', err instanceof Error ? err.message : err);
    }
  }, 18_000);

  async function runSweep(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const config = useConfig();
      // Cheap pre-check so a disabled instance doesn't touch the DB every tick.
      if (!config.features.emailNotifications || !config.features.contestReminders) return;

      const db = useDB();
      const runtimeConfig = useRuntimeConfig();
      const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
      const siteName = config.instance.name || 'CommonPub';
      const secret = (runtimeConfig.authSecret as string) || '';

      const result = await sweepContestReminders(db, config, { siteUrl, siteName, secret });
      if (result.enqueued > 0) {
        console.log(`[contest-reminders] enqueued ${result.enqueued} reminder(s) across ${result.contests} contest(s)`);
      }
    } catch (err) {
      console.error('[contest-reminders] sweep error:', err instanceof Error ? err.message : err);
    } finally {
      running = false;
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
