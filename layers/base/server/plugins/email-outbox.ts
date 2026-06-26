/**
 * Email outbox worker (email Phase 1).
 *
 * Drains the `email_outbox` table on an interval: claims a batch (FOR UPDATE SKIP
 * LOCKED), sends it through the provider's batch API, and reschedules failures
 * with backoff. The COUNTERPART to notification-email.ts — that plugin PRODUCES
 * outbox rows (instant + digest), this one CONSUMES them. Auth mail (verify/reset)
 * bypasses the outbox and sends directly, so it is unaffected.
 *
 * Gated by the same `emailNotifications` flag, so it is inert in prod until email
 * is enabled. A re-entrancy guard prevents overlapping ticks.
 */
import { drainEmailOutbox } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let timer: ReturnType<typeof setInterval> | null = null;
  let draining = false;

  const startupTimer = setTimeout(() => {
    try {
      const config = useConfig();
      if (!config.features.emailNotifications) return; // notification-email.ts logs the "disabled" line

      const rc = useRuntimeConfig();
      const intervalMs = parseInt(rc.emailWorkerIntervalMs as string, 10) || 8000;
      const maxPerTick = parseInt(rc.emailMaxPerTick as string, 10) || 200;
      const batchSize = parseInt(rc.emailBatchSize as string, 10) || 100;
      const maxBatchesPerSecond = parseInt(rc.emailMaxSendsPerSecond as string, 10) || 5;
      const maxAttempts = parseInt(rc.emailMaxAttempts as string, 10) || 6;

      timer = setInterval(() => {
        if (draining) return; // a previous tick is still sending — skip this one
        draining = true;
        drainEmailOutbox(useDB(), useEmailAdapter(), {
          maxPerTick,
          batchSize,
          maxBatchesPerSecond,
          maxAttempts,
        })
          .then((r) => {
            if (r.sent > 0 || r.failed > 0) {
              console.log(`[email-outbox] sent ${r.sent}, failed ${r.failed} (claimed ${r.claimed})`);
            }
          })
          .catch((err) => {
            console.error('[email-outbox] drain error:', err instanceof Error ? err.message : err);
          })
          .finally(() => {
            draining = false;
          });
      }, intervalMs);

      console.log(`[email-outbox] worker started (interval: ${intervalMs}ms, batch: ${batchSize})`);
    } catch (err) {
      console.error('[email-outbox] failed to start:', err instanceof Error ? err.message : err);
    }
  }, 5_000);

  nitro.hooks.hook('close', () => {
    clearTimeout(startupTimer);
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });
});
