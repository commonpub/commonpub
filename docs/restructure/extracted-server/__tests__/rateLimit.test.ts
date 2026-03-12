import { describe, it, expect, afterEach } from 'vitest';
import { RateLimitStore, getTierForPath, DEFAULT_TIERS } from '../rateLimit';

describe('RateLimitStore', () => {
  let store: RateLimitStore;

  afterEach(() => {
    store?.destroy();
  });

  it('allows requests within the limit', () => {
    store = new RateLimitStore();
    const tier = { limit: 3, windowMs: 60_000 };
    const r1 = store.check('key1', tier);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('blocks requests exceeding the limit', () => {
    store = new RateLimitStore();
    const tier = { limit: 2, windowMs: 60_000 };
    store.check('key2', tier);
    store.check('key2', tier);
    const r3 = store.check('key2', tier);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('resets after window expires', () => {
    store = new RateLimitStore();
    const tier = { limit: 1, windowMs: 1 }; // 1ms window
    store.check('key3', tier);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = store.check('key3', tier);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(0);
        resolve();
      }, 10);
    });
  });

  it('tracks separate keys independently', () => {
    store = new RateLimitStore();
    const tier = { limit: 1, windowMs: 60_000 };
    store.check('a', tier);
    const resultB = store.check('b', tier);
    expect(resultB.allowed).toBe(true);
  });

  it('returns correct resetAt timestamp', () => {
    store = new RateLimitStore();
    const before = Date.now();
    const tier = { limit: 10, windowMs: 60_000 };
    const result = store.check('key4', tier);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});

describe('getTierForPath', () => {
  it('returns auth tier for /auth/ paths', () => {
    expect(getTierForPath('/auth/signin')).toBe(DEFAULT_TIERS.auth);
    expect(getTierForPath('/api/auth/session')).toBe(DEFAULT_TIERS.auth);
  });

  it('returns social tier for /api/social/ paths', () => {
    expect(getTierForPath('/api/social/like')).toBe(DEFAULT_TIERS.social);
    expect(getTierForPath('/api/social/comments')).toBe(DEFAULT_TIERS.social);
  });

  it('returns federation tier for federation paths', () => {
    expect(getTierForPath('/api/federation/follow')).toBe(DEFAULT_TIERS.federation);
    expect(getTierForPath('/inbox')).toBe(DEFAULT_TIERS.federation);
    expect(getTierForPath('/users/alice/inbox')).toBe(DEFAULT_TIERS.federation);
  });

  it('returns api tier for other /api/ paths', () => {
    expect(getTierForPath('/api/docs/search')).toBe(DEFAULT_TIERS.api);
  });

  it('returns general tier for other paths', () => {
    expect(getTierForPath('/dashboard')).toBe(DEFAULT_TIERS.general);
    expect(getTierForPath('/')).toBe(DEFAULT_TIERS.general);
  });
});
