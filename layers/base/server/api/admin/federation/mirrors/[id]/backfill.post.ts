import { getMirror, backfillFromOutbox } from '@commonpub/server';
import { z } from 'zod';
/** Extract clean domain from URL */
function extractDomain(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url.replace(/^https?:\/\//, '').replace(/[:/].*$/, ''); }
}

/**
 * POST /api/admin/federation/mirrors/[id]/backfill
 * Crawl the remote instance's outbox to import historical content.
 *
 * Bounded by operator choice so a mirror of a large instance can't pull thousands at once:
 *  - `sinceDays` — only import items published within the last N days (maps to backfill `since`)
 *  - `maxItems`  — hard cap on items pulled this run
 * Both optional; `mirrorMaxItems` from federation config remains the ceiling. Admin only.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'federation.manage');

  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const { id: mirrorId } = parseParams(event, { id: 'uuid' });
  const body = await parseBody(event, z.object({
    sinceDays: z.number().int().positive().max(3650).optional(),
    maxItems: z.number().int().positive().max(10000).optional(),
  }).optional()).catch(() => ({} as { sinceDays?: number; maxItems?: number }));
  const db = useDB();

  const mirror = await getMirror(db, mirrorId);
  if (!mirror) {
    throw createError({ statusCode: 404, statusMessage: 'Mirror not found' });
  }

  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);

  const ceiling = config.federation?.mirrorMaxItems;
  const requested = body?.maxItems;
  const maxItems = ceiling != null
    ? Math.min(requested ?? ceiling, ceiling)
    : requested;
  const since = body?.sinceDays != null
    ? new Date(Date.now() - body.sinceDays * 24 * 60 * 60 * 1000)
    : undefined;

  // Manual admin backfill crawls fresh from the top each run (no cursor resume) so a
  // depth-picked "last N days" run isn't skewed by a stale cursor from a prior full crawl.
  // processInboxActivity upserts by objectUri, so re-crawling is idempotent.
  const result = await backfillFromOutbox(db, mirror.remoteActorUri, domain, {
    ...(maxItems != null ? { maxItems } : {}),
    ...(since ? { since } : {}),
    // Forward the per-mirror cap so crawled items honor the same ceiling the live inbox enforces.
    ...(config.federation ? { federationConfig: { mirrorMaxItems: config.federation.mirrorMaxItems } } : {}),
  });

  return {
    mirrorId: mirror.id,
    remoteDomain: mirror.remoteDomain,
    ...result,
  };
});
