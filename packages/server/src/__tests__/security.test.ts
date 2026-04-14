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

  it('maps auth paths to auth tier', () => {
    expect(getTierForPath('/api/auth/login')).toBe(DEFAULT_TIERS.auth);
    expect(getTierForPath('/api/auth/sign-up')).toBe(DEFAULT_TIERS.auth);
  });

  it('maps API paths to api tier', () => {
    expect(getTierForPath('/api/content')).toBe(DEFAULT_TIERS.api);
    expect(getTierForPath('/api/hubs')).toBe(DEFAULT_TIERS.api);
  });

  it('skips rate limiting for static assets', () => {
    expect(shouldSkipRateLimit('/_app/immutable/chunks/foo.js')).toBe(true);
    expect(shouldSkipRateLimit('/_nuxt/entry.abc123.js')).toBe(true);
  });

  it('does not skip rate limiting for API routes', () => {
    expect(shouldSkipRateLimit('/api/content')).toBe(false);
    expect(shouldSkipRateLimit('/api/auth/login')).toBe(false);
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

  it('checkRateLimit returns allowed result with headers', () => {
    store = new RateLimitStore();
    const { result, headers } = checkRateLimit(store, '127.0.0.1', '/api/content');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(headers['X-RateLimit-Limit']).toBeDefined();
    expect(headers['X-RateLimit-Remaining']).toBeDefined();
  });
});
