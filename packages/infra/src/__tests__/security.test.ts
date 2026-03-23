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
} from '../security.js';

describe('buildCspDirectives', () => {
  it('returns directives without nonce', () => {
    const dirs = buildCspDirectives();
    expect(dirs['default-src']).toBe("'self'");
    expect(dirs['script-src']).toBe("'self'");
    expect(dirs['style-src']).toContain("'unsafe-inline'");
    expect(dirs['img-src']).toContain('data:');
    expect(dirs['frame-ancestors']).toBe("'none'");
  });

  it('includes nonce in script-src and style-src when provided', () => {
    const dirs = buildCspDirectives('abc123');
    expect(dirs['script-src']).toBe("'self' 'nonce-abc123'");
    expect(dirs['style-src']).toContain("'nonce-abc123'");
    expect(dirs['style-src']).not.toContain("'unsafe-inline'");
  });

  it('includes frame-src for video embeds', () => {
    const dirs = buildCspDirectives();
    expect(dirs['frame-src']).toContain('youtube');
    expect(dirs['frame-src']).toContain('vimeo');
  });

  it('sets font-src, connect-src, base-uri, form-action to self', () => {
    const dirs = buildCspDirectives();
    expect(dirs['font-src']).toContain("'self'");
    expect(dirs['connect-src']).toBe("'self'");
    expect(dirs['base-uri']).toBe("'self'");
    expect(dirs['form-action']).toBe("'self'");
  });
});

describe('buildCspHeader', () => {
  it('formats directives as semicolon-separated string', () => {
    const header = buildCspHeader({ 'default-src': "'self'", 'img-src': "'self' data:" });
    expect(header).toBe("default-src 'self'; img-src 'self' data:");
  });

  it('uses default directives when none provided', () => {
    const header = buildCspHeader();
    expect(header).toContain("default-src 'self'");
    expect(header).toContain('script-src');
  });
});

describe('getSecurityHeaders', () => {
  it('includes common security headers', () => {
    const headers = getSecurityHeaders(false);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });

  it('includes HSTS in production', () => {
    const headers = getSecurityHeaders(false);
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
  });

  it('omits HSTS in development', () => {
    const headers = getSecurityHeaders(true);
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });
});

describe('getStaticCacheHeaders', () => {
  it('returns immutable cache headers', () => {
    const headers = getStaticCacheHeaders();
    expect(headers['Cache-Control']).toContain('immutable');
    expect(headers['Cache-Control']).toContain('max-age=31536000');
  });
});

describe('generateNonce', () => {
  it('returns a string without dashes', () => {
    const nonce = generateNonce();
    expect(nonce).not.toContain('-');
    expect(nonce.length).toBe(32);
  });

  it('generates unique values', () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe('getTierForPath', () => {
  it('returns auth tier for /auth/ paths', () => {
    expect(getTierForPath('/auth/login')).toBe(DEFAULT_TIERS.auth);
    expect(getTierForPath('/api/auth/session')).toBe(DEFAULT_TIERS.auth);
  });

  it('returns upload tier for file upload paths', () => {
    expect(getTierForPath('/api/files/upload')).toBe(DEFAULT_TIERS.upload);
  });

  it('returns social tier for social paths', () => {
    expect(getTierForPath('/api/social/likes')).toBe(DEFAULT_TIERS.social);
  });

  it('returns federation tier for federation paths', () => {
    expect(getTierForPath('/api/federation/inbox')).toBe(DEFAULT_TIERS.federation);
    expect(getTierForPath('/inbox')).toBe(DEFAULT_TIERS.federation);
    expect(getTierForPath('/users/alice')).toBe(DEFAULT_TIERS.federation);
  });

  it('returns api tier for generic API paths', () => {
    expect(getTierForPath('/api/content')).toBe(DEFAULT_TIERS.api);
  });

  it('returns general tier for non-API paths', () => {
    expect(getTierForPath('/about')).toBe(DEFAULT_TIERS.general);
    expect(getTierForPath('/')).toBe(DEFAULT_TIERS.general);
  });
});

describe('shouldSkipRateLimit', () => {
  it('skips static asset paths', () => {
    expect(shouldSkipRateLimit('/_nuxt/chunk.js')).toBe(true);
    expect(shouldSkipRateLimit('/_app/immutable/entry.js')).toBe(true);
    expect(shouldSkipRateLimit('/favicon.ico')).toBe(true);
    expect(shouldSkipRateLimit('/assets/style.css')).toBe(true);
    expect(shouldSkipRateLimit('/fonts/mono.woff2')).toBe(true);
    expect(shouldSkipRateLimit('/img/logo.png')).toBe(true);
    expect(shouldSkipRateLimit('/img/photo.jpg')).toBe(true);
    expect(shouldSkipRateLimit('/icon.svg')).toBe(true);
  });

  it('does not skip API and page paths', () => {
    expect(shouldSkipRateLimit('/api/content')).toBe(false);
    expect(shouldSkipRateLimit('/auth/login')).toBe(false);
    expect(shouldSkipRateLimit('/')).toBe(false);
  });
});

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
    store.check('key1', tier);
    const r2 = store.check('key1', tier);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);
    const r3 = store.check('key1', tier);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('blocks exactly at limit+1 (not at limit)', () => {
    store = new RateLimitStore();
    const tier = { limit: 3, windowMs: 60_000 };
    store.check('x', tier); // 1
    store.check('x', tier); // 2
    const atLimit = store.check('x', tier); // 3 = limit
    expect(atLimit.allowed).toBe(true);
    expect(atLimit.remaining).toBe(0);
    const overLimit = store.check('x', tier); // 4 > limit
    expect(overLimit.allowed).toBe(false);
  });

  it('tracks different keys independently', () => {
    store = new RateLimitStore();
    const tier = { limit: 1, windowMs: 60_000 };
    const r1 = store.check('a', tier);
    const r2 = store.check('b', tier);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });

  it('resets after window expires', () => {
    store = new RateLimitStore();
    const tier = { limit: 1, windowMs: 1 }; // 1ms window
    store.check('key1', tier);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const r2 = store.check('key1', tier);
        expect(r2.allowed).toBe(true);
        resolve();
      }, 10);
    });
  });

  it('returns resetAt timestamp', () => {
    store = new RateLimitStore();
    const now = Date.now();
    const tier = { limit: 5, windowMs: 60_000 };
    const result = store.check('key1', tier);
    expect(result.resetAt).toBeGreaterThanOrEqual(now + 59_000);
    expect(result.resetAt).toBeLessThanOrEqual(now + 61_000);
  });
});

describe('checkRateLimit', () => {
  let store: RateLimitStore;

  afterEach(() => {
    store?.destroy();
  });

  it('returns result and rate limit headers', () => {
    store = new RateLimitStore();
    const { result, headers } = checkRateLimit(store, '127.0.0.1', '/api/content');
    expect(result.allowed).toBe(true);
    expect(headers['X-RateLimit-Limit']).toBeDefined();
    expect(headers['X-RateLimit-Remaining']).toBeDefined();
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('includes Retry-After header when blocked', () => {
    store = new RateLimitStore();
    // Exhaust the auth tier (limit: 5)
    for (let i = 0; i < 6; i++) {
      checkRateLimit(store, '127.0.0.1', '/auth/login');
    }
    const { result, headers } = checkRateLimit(store, '127.0.0.1', '/auth/login');
    expect(result.allowed).toBe(false);
    expect(headers['Retry-After']).toBeDefined();
  });

  it('uses userId for key when authenticated — independent limits per user', () => {
    store = new RateLimitStore();
    // Exhaust user1's auth limit (5 requests)
    for (let i = 0; i < 6; i++) {
      checkRateLimit(store, '127.0.0.1', '/auth/login', 'user1');
    }
    // user1 should be blocked
    const blocked = checkRateLimit(store, '127.0.0.1', '/auth/login', 'user1');
    expect(blocked.result.allowed).toBe(false);
    // user2 on the same IP should still be allowed
    const allowed = checkRateLimit(store, '127.0.0.1', '/auth/login', 'user2');
    expect(allowed.result.allowed).toBe(true);
  });
});

describe('DEFAULT_TIERS', () => {
  it('defines expected tier names', () => {
    expect(DEFAULT_TIERS.auth).toBeDefined();
    expect(DEFAULT_TIERS.upload).toBeDefined();
    expect(DEFAULT_TIERS.social).toBeDefined();
    expect(DEFAULT_TIERS.federation).toBeDefined();
    expect(DEFAULT_TIERS.api).toBeDefined();
    expect(DEFAULT_TIERS.general).toBeDefined();
  });

  it('auth tier is most restrictive', () => {
    expect(DEFAULT_TIERS.auth!.limit).toBeLessThan(DEFAULT_TIERS.general!.limit);
  });
});
