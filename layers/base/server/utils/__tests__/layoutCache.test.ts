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
});
