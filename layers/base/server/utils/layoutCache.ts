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
 *
 * **R4 audit fix (session 160)**: bounded LRU. Previously the cache was
 * an unbounded Map — an adversarial client (or a misbehaving crawler)
 * hitting `/api/layouts/by-route?path=/<random>` thousands of times
 * grew the map without limit. After the R3 cache-key trifurcation
 * (admin/members/anon), each unique path could land 3 entries. Bounded
 * here to MAX_CACHE_ENTRIES with LRU eviction.
 */
export interface LayoutCacheEntry<T> {
  value: T | null;
  at: number;
}

export const LAYOUT_CACHE_TTL_MS = 60_000;

/**
 * Maximum entries the cache will hold. At ~512 bytes per key + value,
 * this caps memory at ~512KB per pod — comfortably small. Past this
 * cap, oldest-inserted entries are evicted.
 *
 * Map's natural insertion-order semantics make LRU-on-set trivial:
 * delete + reinsert moves an entry to the "newest" end. Eviction
 * iterates from the oldest end.
 */
export const MAX_CACHE_ENTRIES = 1000;

const cache = new Map<string, LayoutCacheEntry<unknown>>();

export function getLayoutCacheEntry<T>(key: string): LayoutCacheEntry<T> | undefined {
  const entry = cache.get(key) as LayoutCacheEntry<T> | undefined;
  if (entry !== undefined) {
    // LRU touch: move this key to the "newest" end of insertion order.
    // The cache stays in oldest-first iteration order so eviction is O(1).
    cache.delete(key);
    cache.set(key, entry);
  }
  return entry;
}

export function setLayoutCacheEntry<T>(key: string, value: T | null, at: number = Date.now()): void {
  // If key exists, drop it first so the re-insert lands at the newest end.
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { value, at });

  // Evict oldest entries past the cap. Map preserves insertion order, so
  // the first key in iteration is the least-recently-touched.
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
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
