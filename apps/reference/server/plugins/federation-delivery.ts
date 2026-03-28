/**
 * Federation activity delivery worker.
 * Runs every 30 seconds to deliver pending outbound AP activities.
 *
 * NOTE: Nitro plugins run at server bootstrap. The 'ready' hook is a build-time
 * hook and does NOT fire at runtime, so we start the interval directly with a
 * short delay to let the DB connection pool initialize.
 */
import { deliverPendingActivities } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;

  // Small delay so DB pool and config are available
  const startupTimer = setTimeout(() => {
    try {
      const config = useConfig();
      if (!config.features.federation) {
        console.log('[federation] Federation disabled — delivery worker not started');
        return;
      }

      const runtimeConfig = useRuntimeConfig();
      const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
      const domain = siteUrl.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');

      console.log(`[federation] Activity delivery worker started (domain: ${domain})`);

      // Run once immediately to flush any pending activities from before restart
      runDelivery(domain);

      interval = setInterval(() => runDelivery(domain), 30_000);
    } catch (err) {
      console.error('[federation] Delivery worker failed to start:', err instanceof Error ? err.message : err);
    }
  }, 5_000);

  async function runDelivery(domain: string) {
    try {
      const db = useDB();
      const result = await deliverPendingActivities(db, domain, 10);
      if (result.delivered > 0 || result.failed > 0) {
        console.log(`[federation] Delivered: ${result.delivered}, Failed: ${result.failed}`);
      }
      if (result.errors.length > 0) {
        console.warn('[federation] Delivery errors:', result.errors.slice(0, 3).join('; '));
      }
    } catch (err) {
      console.error('[federation] Delivery worker error:', err instanceof Error ? err.message : err);
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
