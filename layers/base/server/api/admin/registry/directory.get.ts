import { safeFetch } from '@commonpub/protocol';

/**
 * GET /api/admin/registry/directory (Phase 4 — peer discovery)
 *
 * For an instance that ANNOUNCES to a registry but is not itself a registry:
 * fetch the configured registry's PUBLIC directory (`GET /api/registry/instances`)
 * so the operator can see every peer registered there. Without this, only the
 * registry server itself could see the directory — pinging instances had no way
 * to discover each other.
 *
 * Read-only (no hide/block — those are registry-owner controls). SSRF-guarded via
 * `safeFetch`. Admin only, gated on `features.announceToRegistry`.
 */
export default defineEventHandler(async (event) => {
  requirePermission(event, 'federation.manage');
  requireFeature('announceToRegistry');

  const config = useConfig();
  const registryUrl = config.federation?.registryUrl;
  if (!registryUrl) {
    return { instances: [], total: 0, registryUrl: null, self: false };
  }

  let regHost: string;
  try {
    regHost = new URL(registryUrl).hostname;
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Invalid registryUrl config' });
  }

  // If we ping ourselves (this instance IS its own registry), there's no remote
  // directory to pull — the local actAsRegistry view already covers it.
  if (regHost === config.instance.domain) {
    return { instances: [], total: 0, registryUrl, self: true };
  }

  const q = getQuery(event);
  const search = typeof q.search === 'string' ? q.search : '';
  const target = new URL('/api/registry/instances', registryUrl);
  if (search) target.searchParams.set('search', search);
  target.searchParams.set('limit', '50');

  try {
    const { html } = await safeFetch(target.toString(), { timeoutMs: 10_000 });
    const json = JSON.parse(html) as { instances?: unknown[]; total?: number };
    return {
      instances: Array.isArray(json.instances) ? json.instances : [],
      total: typeof json.total === 'number' ? json.total : 0,
      registryUrl,
      self: false,
    };
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Could not reach the registry directory' });
  }
});
