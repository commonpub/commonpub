/**
 * GET /api/layouts/by-route?path=/some-path
 *
 * Public endpoint — resolves the active layout for a route, used by the
 * `<LayoutSlot>` renderer on every page request. Returns the published
 * version when available, otherwise the draft (during pre-publish
 * editing — admins see drafts, end users get a 404 until published).
 *
 * Cached server-side for `LAYOUT_CACHE_TTL_MS` per path (see
 * `server/utils/layoutCache.ts`). Invalidated on any layout write —
 * the admin POST/PUT/DELETE/publish/revert handlers each call
 * `invalidateLayoutsByRouteCache()` before returning.
 *
 * Gated by `features.layoutEngine`. Returns 404 when off so the legacy
 * homepage section renderer keeps working.
 */
import { getLayoutByScope, type LayoutRecord, type LayoutScope } from '@commonpub/server';
import {
  LAYOUT_CACHE_TTL_MS,
  getLayoutCacheEntry,
  setLayoutCacheEntry,
} from '../../utils/layoutCache';

// Re-export for callers that import the invalidator from this file
// (kept for backwards compat after the session-158 refactor that moved
// the cache into utils/). New code should import from utils/layoutCache.
export { invalidateLayoutsByRouteCache } from '../../utils/layoutCache';

interface PublicLayoutSlice {
  /** Zones → rows → enabled+visible sections only. Strips draft metadata. */
  zones: LayoutRecord['zones'];
  /** Page meta for custom pages; null for routes. */
  pageMeta: LayoutRecord['pageMeta'];
  /** State so SSR can mark `noindex` on drafts. */
  state: LayoutRecord['state'];
}

export default defineEventHandler(async (event): Promise<PublicLayoutSlice | null> => {
  const config = useConfig();
  if (!(config.features as unknown as Record<string, boolean>).layoutEngine) {
    // Feature off — return 404 so the legacy renderer stays in charge
    throw createError({ statusCode: 404, statusMessage: 'Layout engine not enabled' });
  }

  const { path } = parseQueryParams(event, layoutsByRoutePathSchema);
  const cacheKey = path;
  const hit = getLayoutCacheEntry<PublicLayoutSlice>(cacheKey);
  const now = Date.now();
  if (hit && now - hit.at < LAYOUT_CACHE_TTL_MS) {
    return hit.value;
  }

  const db = useDB();
  // Try route scope first, then custom-page (custom pages shadow routes)
  const scope: LayoutScope = isCustomPagePath(path)
    ? { type: 'custom-page', path }
    : { type: 'route', path };

  const layout = await getLayoutByScope(db, scope);
  const value: PublicLayoutSlice | null = layout
    ? {
        zones: layout.zones,
        pageMeta: layout.pageMeta,
        state: layout.state,
      }
    : null;

  setLayoutCacheEntry(cacheKey, value, now);
  return value;
});

/**
 * Heuristic: paths NOT in the file-routes manifest are candidate
 * custom-page paths. For Phase 1, we leave this as `false` (always
 * resolve as route scope) — custom-page support lands in Phase 2 once
 * the catch-all + conflict detection is in.
 */
function isCustomPagePath(_path: string): boolean {
  return false;
}

// Inline Zod since the public-API surface keeps validators close to handlers
// (matches the pattern used elsewhere — e.g. /api/profile/theme.put.ts).
import { z } from 'zod';
const layoutsByRoutePathSchema = z.object({
  path: z.string().min(1).max(512).regex(/^\/[a-zA-Z0-9._~/-]*$/, 'Path must start with /'),
});
