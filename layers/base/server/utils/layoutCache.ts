/**
 * Shared layout-resolution cache.
 *
 * The `/api/layouts/by-route` endpoint reads from this; every admin
 * layout write handler MUST invalidate after success (otherwise SSR
 * serves stale data for up to TTL_MS after a save).
 *
 * Kept here (utils/) rather than inline in `api/layouts/by-route.get.ts`
 * so the admin write routes can import the invalidator without
 * cross-file-handler imports (nitro's route-discovery treats `*.get.ts`
 * + `*.post.ts` as handlers, not regular modules — utility shared state
 * belongs in `utils/`).
 *
 * Per-process map → 60s TTL bounds staleness across pods. The Phase 10
 * performance pass (`docs/plans/layout-and-pages.md` §10) replaces this
 * with ETag-based revalidation; the in-memory cache is sufficient for
 * Phase 1c volumes.
 */
export interface LayoutCacheEntry<T> {
  value: T | null;
  at: number;
}

export const LAYOUT_CACHE_TTL_MS = 60_000;
const cache = new Map<string, LayoutCacheEntry<unknown>>();

export function getLayoutCacheEntry<T>(key: string): LayoutCacheEntry<T> | undefined {
  return cache.get(key) as LayoutCacheEntry<T> | undefined;
}

export function setLayoutCacheEntry<T>(key: string, value: T | null, at: number = Date.now()): void {
  cache.set(key, { value, at });
}

/**
 * Drop every cached entry. Called from every admin layout write
 * handler (POST/PUT/DELETE on layouts, publish, revert, seed) BEFORE
 * the response is sent. A more selective `invalidate(scopeKey)` is
 * possible — but the cache is tiny (one entry per ever-visited route)
 * and full-clear is the safer default while the editor is still
 * coalescing draft saves (Phase 7+).
 */
export function invalidateLayoutsByRouteCache(): void {
  cache.clear();
}

/**
 * Cache size — for test-only inspection (verify a write actually
 * cleared the cache rather than just calling a no-op function).
 */
export function _layoutCacheSize(): number {
  return cache.size;
}
