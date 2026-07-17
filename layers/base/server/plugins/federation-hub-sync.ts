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
import { eq, and, or, lt, isNull, inArray } from 'drizzle-orm';

const MAX_HUBS_PER_CYCLE = 5;
const STAGGER_DELAY_MS = 2_000;

export default defineNitroPlugin((nitro) => {
  if (process.env.NODE_ENV === 'test') return;

  let interval: ReturnType<typeof setInterval> | null = null;

  const startupTimer = setTimeout(() => {
    try {
      const config = useConfig();
      if (!config.features.federateHubs) {
        console.log('[hub-sync] Hub federation disabled, sync worker not started');
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

      // Stale predicate: lastSyncAt is null or older than the interval. Reused for
      // both the candidate select and the atomic claim so the claim only succeeds
      // while the row is still stale (compare-and-claim).
      const isStale = or(
        isNull(federatedHubs.lastSyncAt),
        lt(federatedHubs.lastSyncAt, staleThreshold),
      );

      // Find accepted, non-hidden hubs that are stale (candidates). We capture the
      // prior lastSyncAt here (before the claim overwrites it) so first-sync
      // detection survives the atomic claim below.
      const candidates = await db
        .select({ id: federatedHubs.id, lastSyncAt: federatedHubs.lastSyncAt })
        .from(federatedHubs)
        .where(and(
          eq(federatedHubs.status, 'accepted'),
          eq(federatedHubs.isHidden, false),
          isStale,
        ))
        .limit(MAX_HUBS_PER_CYCLE);

      if (candidates.length === 0) return;

      // Map id -> was-this-a-first-sync (prior lastSyncAt null), captured pre-claim.
      const wasFirstSync = new Map<string, boolean>(
        candidates.map((c) => [c.id, c.lastSyncAt === null]),
      );

      // Atomic claim (mirrors federation-delivery's compare-and-claim): set
      // lastSyncAt = now() on the selected ids, but only WHERE still stale. On N
      // replicas selecting the same hubs, exactly one replica's UPDATE matches the
      // stale predicate per row, so each hub is claimed (and fetched from remotes)
      // once per cycle instead of N times. RETURNING gives us the rows we won.
      const candidateIds = candidates.map((c) => c.id);
      const claimedAt = new Date();
      const staleHubs = await db
        .update(federatedHubs)
        .set({ lastSyncAt: claimedAt })
        .where(and(
          inArray(federatedHubs.id, candidateIds),
          isStale,
        ))
        .returning({
          id: federatedHubs.id,
          actorUri: federatedHubs.actorUri,
          name: federatedHubs.name,
        });

      if (staleHubs.length === 0) return; // another replica claimed them first

      console.log(`[hub-sync] Claimed ${staleHubs.length} stale hub(s) to sync`);

      for (const hub of staleHubs) {
        try {
          // Refresh metadata (name, description, icon, member count)
          await refreshFederatedHubMetadata(db, hub.id, hub.actorUri);

          // Fetch followers to populate members list (first sync or periodic refresh)
          if (wasFirstSync.get(hub.id)) {
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
            const result = await backfillHubFromOutbox(db, hub.id, domain, config.federation);
            if (result.processed > 0 || result.errors > 0) {
              console.log(`[hub-sync] Backfill ${hub.name}: ${result.processed} processed, ${result.errors} errors`);
            }
          }

          // Refresh lastSyncAt to completion time. The atomic claim above already
          // set it to the claim time (which is what prevents other replicas from
          // re-claiming); this just advances it to reflect successful completion.
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
