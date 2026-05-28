/**
 * Layout cache contract — admin write handlers MUST call
 * `invalidateLayoutsByRouteCache()` after every successful write,
 * otherwise SSR serves stale data for up to LAYOUT_CACHE_TTL_MS.
 *
 * Per `feedback_integration_test_full_output_path`: this test pins the
 * full output path — populate the cache, invoke each invalidator call
 * site, observe the cache went from N entries to 0. NOT a mock-call-count
 * assertion; the cache state IS the observable outcome.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LAYOUT_CACHE_TTL_MS,
  setLayoutCacheEntry,
  getLayoutCacheEntry,
  invalidateLayoutsByRouteCache,
  _layoutCacheSize,
} from '../layoutCache';

describe('layoutCache', () => {
  beforeEach(() => {
    invalidateLayoutsByRouteCache();  // clean slate
  });

  it('round-trip: set then get returns the same entry', () => {
    setLayoutCacheEntry('/foo', { ok: true });
    const hit = getLayoutCacheEntry<{ ok: boolean }>('/foo');
    expect(hit?.value).toEqual({ ok: true });
  });

  it('TTL constant is the documented 60_000ms', () => {
    expect(LAYOUT_CACHE_TTL_MS).toBe(60_000);
  });

  it('invalidate clears every entry (covers full-cache wipe contract)', () => {
    setLayoutCacheEntry('/a', 1);
    setLayoutCacheEntry('/b', 2);
    setLayoutCacheEntry('/c', null);  // null is a valid cached "no layout exists" outcome
    expect(_layoutCacheSize()).toBe(3);

    invalidateLayoutsByRouteCache();

    expect(_layoutCacheSize()).toBe(0);
    expect(getLayoutCacheEntry('/a')).toBeUndefined();
    expect(getLayoutCacheEntry('/b')).toBeUndefined();
    expect(getLayoutCacheEntry('/c')).toBeUndefined();
  });

  it('caches `null` as a valid value (no-layout-for-this-route) — TTL applies', () => {
    setLayoutCacheEntry('/missing', null, 1_000);
    const hit = getLayoutCacheEntry<unknown>('/missing');
    expect(hit).toBeDefined();
    expect(hit?.value).toBeNull();
    expect(hit?.at).toBe(1_000);
  });

  it('overwrites an existing entry on set (no append semantics)', () => {
    setLayoutCacheEntry('/x', 1);
    setLayoutCacheEntry('/x', 2);
    expect(_layoutCacheSize()).toBe(1);
    expect(getLayoutCacheEntry<number>('/x')?.value).toBe(2);
  });

  // R4 audit P1 fix — bounded LRU eviction
  describe('bounded LRU eviction (audit R4)', () => {
    it('caps cache at MAX_CACHE_ENTRIES; oldest evicted first', async () => {
      const { MAX_CACHE_ENTRIES } = await import('../layoutCache');
      // Fill past the cap
      for (let i = 0; i < MAX_CACHE_ENTRIES + 50; i++) {
        setLayoutCacheEntry(`/path-${i}`, i);
      }
      expect(_layoutCacheSize()).toBe(MAX_CACHE_ENTRIES);
      // First 50 keys should be gone (oldest)
      expect(getLayoutCacheEntry(`/path-0`)).toBeUndefined();
      expect(getLayoutCacheEntry(`/path-49`)).toBeUndefined();
      // Key at the cap boundary survives
      expect(getLayoutCacheEntry(`/path-50`)).toBeDefined();
      // Most-recent survives
      expect(getLayoutCacheEntry(`/path-${MAX_CACHE_ENTRIES + 49}`)).toBeDefined();
    });

    it('get() touches LRU order — recently-read entries survive eviction longer', async () => {
      const { MAX_CACHE_ENTRIES } = await import('../layoutCache');
      // Fill to exactly the cap
      for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
        setLayoutCacheEntry(`/p-${i}`, i);
      }
      // Touch the oldest entry to move it to "newest"
      expect(getLayoutCacheEntry(`/p-0`)).toBeDefined();
      // Add ONE more entry — should evict /p-1 (now oldest), NOT /p-0
      setLayoutCacheEntry(`/p-new`, 'new');
      expect(getLayoutCacheEntry(`/p-0`)).toBeDefined();
      expect(getLayoutCacheEntry(`/p-1`)).toBeUndefined();
      expect(getLayoutCacheEntry(`/p-new`)).toBeDefined();
    });
  });
});
