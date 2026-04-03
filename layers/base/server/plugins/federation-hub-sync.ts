/**
 * Federation hub sync worker.
 * Periodically refreshes metadata and optionally backfills posts for accepted federated hubs.
 * Gated on features.federateHubs. Configurable via federation.hubSyncIntervalMs.
 */
import {
  refreshFederatedHubMetadata,
  backfillHubFromOutbox,
  fetchRemoteHubFollowers,
} from '@commonpub/server';
import { federatedHubs } from '@commonpub/schema';
import { eq, and, or, lt, isNull } from 'drizzle-orm';

const MAX_HUBS_PER_CYCLE = 5;
const STAGGER_DELAY_MS = 2_000;

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;

  const startupTimer = setTimeout(() => {
    try {
      const config = useConfig();
      if (!config.features.federateHubs) {
        console.log('[hub-sync] Hub federation disabled — sync worker not started');
        return;
      }

      const runtimeConfig = useRuntimeConfig();
      const siteUrl = (runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`;
      const domain = siteUrl.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');

      const fedConfig = config.federation ?? {};
      const intervalMs = fedConfig.hubSyncIntervalMs ?? 3_600_000;
      const backfillOnSync = fedConfig.backfillOnMirrorAccept ?? false;

      console.log(`[hub-sync] Hub sync worker started (domain: ${domain}, interval: ${intervalMs}ms, backfill: ${backfillOnSync})`);

      // Run first sync after a brief delay to avoid startup contention
      runSync(domain, intervalMs, backfillOnSync);

      interval = setInterval(() => {
        runSync(domain, intervalMs, backfillOnSync).catch((err) => {
          console.error('[hub-sync] Sync worker unexpected error:', err instanceof Error ? err.message : err);
        });
      }, intervalMs);
    } catch (err) {
      console.error('[hub-sync] Failed to start:', err instanceof Error ? err.message : err);
    }
  }, 10_000); // 10s startup delay (longer than delivery worker to avoid contention)

  async function runSync(domain: string, intervalMs: number, backfillOnSync: boolean): Promise<void> {
    try {
      const db = useDB();
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - intervalMs);

      // Find accepted, non-hidden hubs where lastSyncAt is older than the interval or null
      const staleHubs = await db
        .select({
          id: federatedHubs.id,
          actorUri: federatedHubs.actorUri,
          name: federatedHubs.name,
          lastSyncAt: federatedHubs.lastSyncAt,
        })
        .from(federatedHubs)
        .where(and(
          eq(federatedHubs.status, 'accepted'),
          eq(federatedHubs.isHidden, false),
          or(
            isNull(federatedHubs.lastSyncAt),
            lt(federatedHubs.lastSyncAt, staleThreshold),
          ),
        ))
        .limit(MAX_HUBS_PER_CYCLE);

      if (staleHubs.length === 0) return;

      console.log(`[hub-sync] Found ${staleHubs.length} stale hub(s) to sync`);

      for (const hub of staleHubs) {
        try {
          // Refresh metadata (name, description, icon, member count)
          await refreshFederatedHubMetadata(db, hub.id, hub.actorUri);

          // Fetch followers to populate members list (first sync or periodic refresh)
          if (!hub.lastSyncAt) {
            // First sync — fetch followers to seed the members table
            try {
              const result = await fetchRemoteHubFollowers(db, hub.id, domain);
              if (result.fetched > 0) {
                console.log(`[hub-sync] Fetched ${result.fetched} followers for ${hub.name}`);
              }
            } catch (err) {
              console.warn(`[hub-sync] Followers fetch failed for ${hub.name}:`, err instanceof Error ? err.message : err);
            }
          }

          // Optionally backfill new posts from outbox
          if (backfillOnSync) {
            const result = await backfillHubFromOutbox(db, hub.id, domain);
            if (result.processed > 0 || result.errors > 0) {
              console.log(`[hub-sync] Backfill ${hub.name}: ${result.processed} processed, ${result.errors} errors`);
            }
          }

          // Update lastSyncAt
          await db.update(federatedHubs).set({
            lastSyncAt: new Date(),
          }).where(eq(federatedHubs.id, hub.id));
        } catch (err) {
          console.error(`[hub-sync] Failed to sync hub ${hub.name}:`, err instanceof Error ? err.message : err);
        }

        // Stagger between hubs to avoid hammering remote instances
        if (staleHubs.indexOf(hub) < staleHubs.length - 1) {
          await new Promise((r) => setTimeout(r, STAGGER_DELAY_MS));
        }
      }
    } catch (err) {
      console.error('[hub-sync] Sync worker error:', err instanceof Error ? err.message : err);
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
