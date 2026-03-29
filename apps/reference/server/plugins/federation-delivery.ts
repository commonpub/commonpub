/**
 * Federation activity delivery worker.
 * Runs on a configurable interval to deliver pending outbound AP activities.
 * Also runs daily cleanup of old delivered activities.
 */
import { deliverPendingActivities, cleanupDeliveredActivities } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;
  let cleanupCounter = 0;

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

      const fedConfig = config.federation ?? {};
      const intervalMs = fedConfig.deliveryIntervalMs ?? 30_000;
      const batchSize = fedConfig.deliveryBatchSize ?? 20;
      const maxRetries = fedConfig.maxDeliveryRetries ?? 6;
      const retentionDays = fedConfig.activityRetentionDays ?? 90;

      console.log(`[federation] Activity delivery worker started (domain: ${domain}, interval: ${intervalMs}ms, batch: ${batchSize})`);

      runDelivery(domain, batchSize, maxRetries, retentionDays);

      interval = setInterval(() => runDelivery(domain, batchSize, maxRetries, retentionDays), intervalMs);
    } catch (err) {
      console.error('[federation] Delivery worker failed to start:', err instanceof Error ? err.message : err);
    }
  }, 5_000);

  async function runDelivery(domain: string, batchSize: number, maxRetries: number, retentionDays: number) {
    try {
      const db = useDB();
      const result = await deliverPendingActivities(db, domain, { batchSize, maxRetries });
      if (result.delivered > 0 || result.failed > 0) {
        console.log(`[federation] Delivered: ${result.delivered}, Failed: ${result.failed}`);
      }
      if (result.errors.length > 0) {
        console.warn('[federation] Delivery errors:', result.errors.slice(0, 3).join('; '));
      }

      cleanupCounter++;
      const cleanupEvery = Math.max(1, Math.round((24 * 60 * 60 * 1000) / (30_000)));
      if (cleanupCounter >= cleanupEvery) {
        cleanupCounter = 0;
        const deleted = await cleanupDeliveredActivities(db, retentionDays);
        if (deleted > 0) {
          console.log(`[federation] Cleaned up ${deleted} old delivered activities`);
        }
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
