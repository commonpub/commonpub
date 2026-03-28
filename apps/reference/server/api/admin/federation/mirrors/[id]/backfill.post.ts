import { getMirror, backfillFromOutbox } from '@commonpub/server';
/** Extract clean domain from URL */
function extractDomain(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url.replace(/^https?:\/\//, '').replace(/[:/].*$/, ''); }
}

/**
 * POST /api/admin/federation/mirrors/[id]/backfill
 * Crawl the remote instance's outbox to import historical content.
 * Admin only.
 */
export default defineEventHandler(async (event) => {
  const session = event.context.session;
  if (!session?.user || session.user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' });
  }

  const config = useConfig();
  if (!config.features.federation) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const mirrorId = getRouterParam(event, 'id')!;
  const db = useDB();

  const mirror = await getMirror(db, mirrorId);
  if (!mirror) {
    throw createError({ statusCode: 404, statusMessage: 'Mirror not found' });
  }

  const runtimeConfig = useRuntimeConfig();
  const domain = extractDomain((runtimeConfig.public?.siteUrl as string) || `https://${config.instance.domain}`);

  const result = await backfillFromOutbox(db, mirror.remoteActorUri, domain);

  return {
    mirrorId: mirror.id,
    remoteDomain: mirror.remoteDomain,
    ...result,
  };
});
