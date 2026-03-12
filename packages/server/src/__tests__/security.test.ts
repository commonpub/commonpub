import { describe, it, expect, afterEach } from 'vitest';
import {
  buildCspDirectives,
  buildCspHeader,
  getSecurityHeaders,
  getStaticCacheHeaders,
  generateNonce,
  RateLimitStore,
  DEFAULT_TIERS,
  getTierForPath,
  shouldSkipRateLimit,
  checkRateLimit,
} from '../security';

describe('security module', () => {
  it('should export CSP functions', () => {
    expect(typeof buildCspDirectives).toBe('function');
    expect(typeof buildCspHeader).toBe('function');
    expect(typeof generateNonce).toBe('function');
  });

  it('should export header functions', () => {
    expect(typeof getSecurityHeaders).toBe('function');
    expect(typeof getStaticCacheHeaders).toBe('function');
  });

  it('should build CSP directives without nonce', () => {
    const directives = buildCspDirectives();
    expect(directives['script-src']).toBe("'self'");
    expect(directives['default-src']).toBe("'self'");
  });

  it('should build CSP directives with nonce', () => {
    const directives = buildCspDirectives('test-nonce');
    expect(directives['script-src']).toBe("'self' 'nonce-test-nonce'");
  });

  it('should build CSP header string', () => {
    const header = buildCspHeader({ 'default-src': "'self'" });
    expect(header).toBe("default-src 'self'");
  });

  it('should include HSTS in production', () => {
    const headers = getSecurityHeaders(false);
    expect(headers['Strict-Transport-Security']).toBeDefined();
  });

  it('should not include HSTS in dev', () => {
    const headers = getSecurityHeaders(true);
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('should return static cache headers', () => {
    const headers = getStaticCacheHeaders();
    expect(headers['Cache-Control']).toContain('immutable');
  });

  it('should generate a nonce', () => {
    const nonce = generateNonce();
    expect(nonce).toBeTruthy();
    expect(nonce).not.toContain('-');
  });
});

describe('rate limiting', () => {
  let store: RateLimitStore;

  afterEach(() => {
    store?.destroy();
  });

  it('should export RateLimitStore', () => {
    expect(RateLimitStore).toBeDefined();
    store = new RateLimitStore();
    expect(store).toBeInstanceOf(RateLimitStore);
  });

  it('should export DEFAULT_TIERS', () => {
    expect(DEFAULT_TIERS).toBeDefined();
    expect(DEFAULT_TIERS.auth).toBeDefined();
    expect(DEFAULT_TIERS.api).toBeDefined();
  });

  it('should export getTierForPath', () => {
    expect(typeof getTierForPath).toBe('function');
    expect(getTierForPath('/api/auth/login')).toBe(DEFAULT_TIERS.auth);
    expect(getTierForPath('/api/content')).toBe(DEFAULT_TIERS.api);
  });

  it('should export shouldSkipRateLimit', () => {
    expect(typeof shouldSkipRateLimit).toBe('function');
    expect(shouldSkipRateLimit('/_app/immutable/chunks/foo.js')).toBe(true);
    expect(shouldSkipRateLimit('/api/content')).toBe(false);
  });

  it('should allow requests within limit', () => {
    store = new RateLimitStore();
    const tier = { limit: 3, windowMs: 60_000 };
    const r1 = store.check('test-key', tier);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = store.check('test-key', tier);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = store.check('test-key', tier);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests over limit', () => {
    store = new RateLimitStore();
    const tier = { limit: 1, windowMs: 60_000 };
    store.check('block-key', tier);
    const result = store.check('block-key', tier);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should export checkRateLimit', () => {
    expect(typeof checkRateLimit).toBe('function');
    store = new RateLimitStore();
    const { result, headers } = checkRateLimit(store, '127.0.0.1', '/api/content');
    expect(result.allowed).toBe(true);
    expect(headers['X-RateLimit-Limit']).toBeDefined();
  });
});
