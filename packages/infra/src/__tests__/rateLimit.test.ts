import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  MemoryRateLimitStore,
  createRateLimitStore,
  type RateLimitStore,
  type RateLimitTier,
} from '../index.js';

/**
 * Unit tests for the rate-limit store abstraction. The Redis-backed
 * implementation is covered by the integration test in `redis.test.ts`
 * (skipped unless REDIS_URL_TEST is set); everything here runs without
 * external services.
 */

const TIER_3_60s: RateLimitTier = { limit: 3, windowMs: 60_000 };

async function drain(store: RateLimitStore, key: string, tier: RateLimitTier, n: number) {
  for (let i = 0; i < n; i++) await store.check(key, tier);
}

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;
  afterEach(() => store?.destroy());

  it('counts are per-key', async () => {
    store = new MemoryRateLimitStore();
    await drain(store, 'a', TIER_3_60s, 3);
    const a = await store.check('a', TIER_3_60s);
    expect(a.allowed).toBe(false);
    const b = await store.check('b', TIER_3_60s);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(TIER_3_60s.limit - 1);
  });

  it('reports remaining monotonically', async () => {
    store = new MemoryRateLimitStore();
    const results = [];
    for (let i = 0; i < TIER_3_60s.limit; i++) {
      results.push(await store.check('key', TIER_3_60s));
    }
    const remainings = results.map((r) => r.remaining);
    expect(remainings).toEqual([2, 1, 0]);
  });

  it('boundary: allowed at limit, rejected at limit+1', async () => {
    store = new MemoryRateLimitStore();
    for (let i = 1; i <= 3; i++) {
      const r = await store.check('k', TIER_3_60s);
      expect(r.allowed).toBe(true);
    }
    const over = await store.check('k', TIER_3_60s);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
  });
});

describe('createRateLimitStore (factory)', () => {
  it('returns memory-backed store when redisUrl is undefined', async () => {
    const store = createRateLimitStore();
    const r = await store.check('foo', TIER_3_60s);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    await store.destroy();
  });

  it('returns memory-backed store when redisUrl is empty string', async () => {
    const store = createRateLimitStore({ redisUrl: '   ' });
    const r = await store.check('foo', TIER_3_60s);
    expect(r.allowed).toBe(true);
    await store.destroy();
  });

  it('lazy Redis wrapper falls open to memory when ioredis cannot connect', async () => {
    // Bogus URL forces connection failure on first check. The lazy wrapper
    // swallows the failure (onRedisError fires) and returns the memory
    // fallback result. This is the acceptance-criterion fail-open path.
    const errors: Array<{ operation: string; key: string }> = [];
    const store = createRateLimitStore({
      redisUrl: 'redis://127.0.0.1:1', // unreachable port
      onRedisError: (_err, ctx) => errors.push(ctx),
    });

    const r = await store.check('k', TIER_3_60s);
    // Memory fallback served the request, so it's allowed.
    expect(r.allowed).toBe(true);
    await store.destroy();
    // The factory logged either an init error or an ioredis-missing error;
    // in both cases we should have fallen back cleanly.
    // (We don't assert exact errors.length because ioredis retry behavior
    // may or may not fire before the first check resolves.)
  });
});

describe('RateLimitStore interface — back-compat', () => {
  it('`new RateLimitStore()` still constructs a memory store', async () => {
    // Back-compat alias. Callers on 0.5.x did `new RateLimitStore()` and
    // got the memory implementation; we preserve that.
    const { RateLimitStore } = await import('../security.js');
    const store = new RateLimitStore();
    const r = await store.check('x', TIER_3_60s);
    expect(r.allowed).toBe(true);
    store.destroy();
  });
});
