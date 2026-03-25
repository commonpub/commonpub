/**
 * Federation activity delivery worker.
 * Runs every 30 seconds to deliver pending outbound AP activities.
 */
import { deliverPendingActivities } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;

  // @ts-expect-error -- 'ready' hook exists at runtime but Nitro types don't expose it
  nitro.hooks.hook('ready', () => {
    const config = useConfig();
    if (!config.features.federation) return;

    const runtimeConfig = useRuntimeConfig();
    const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
    const domain = siteUrl.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');

    console.log('[federation] Activity delivery worker started');

    interval = setInterval(async () => {
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
    }, 30_000);
  });

  nitro.hooks.hook('close', () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  });
});
