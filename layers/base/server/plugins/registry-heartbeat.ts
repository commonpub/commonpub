/**
 * Registry heartbeat worker (Phase 4).
 * When `features.announceToRegistry` is on, periodically sends a signed heartbeat to the configured
 * `federation.registryUrl` so this instance appears in that registry's directory. Opt-in — nothing
 * is sent unless the operator enables the flag.
 */
import { sendRegistryPing } from '@commonpub/server';

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;

  const startupTimer = setTimeout(() => {
    try {
      const config = useConfig();
      if (!config.features.announceToRegistry) {
        return; // opt-in, silent when off
      }
      // The registry verifies our ping by resolving `https://{instance.domain}/actor`, which is
      // only served when federation is on. Without it every ping 401s — warn + skip.
      if (!config.features.federation) {
        console.warn('[registry] announceToRegistry is on but federation is off, pings would be unverifiable (our /actor is not served). Skipping.');
        return;
      }
      const registryUrl = config.federation?.registryUrl ?? 'https://commonpub.io';

      // Use instance.domain — the heartbeat is signed with `https://{instance.domain}/actor#main-key`
      // and MUST match the served actor's id host (verifyInboxRequest enforces keyId==actor.id host).
      const domain = config.instance.domain;

      // Don't announce a registry to itself.
      const registryDomain = registryUrl.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
      if (registryDomain === domain) {
        console.log('[registry] Skipping heartbeat, this instance is its own registry');
        return;
      }

      const intervalMs = config.federation?.registryPingIntervalMs ?? 21_600_000;
      console.log(`[registry] Heartbeat worker started (registry: ${registryUrl}, interval: ${intervalMs}ms)`);

      runHeartbeat(registryUrl, domain);
      interval = setInterval(() => runHeartbeat(registryUrl, domain), intervalMs);
    } catch (err) {
      console.error('[registry] Heartbeat worker failed to start:', err instanceof Error ? err.message : err);
    }
  }, 10_000); // stagger after the delivery worker (5s)

  async function runHeartbeat(registryUrl: string, domain: string) {
    try {
      const res = await sendRegistryPing(useDB(), registryUrl, domain);
      if (!res.ok) {
        console.warn(`[registry] Heartbeat to ${registryUrl} returned ${res.status}`);
      }
    } catch (err) {
      console.error('[registry] Heartbeat error:', err instanceof Error ? err.message : err);
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
