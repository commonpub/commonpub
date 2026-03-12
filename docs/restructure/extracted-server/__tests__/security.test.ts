import { describe, it, expect } from 'vitest';
import { buildCspHeader, buildCspDirectives, getSecurityHeaders, getStaticCacheHeaders } from '../security';

describe('buildCspHeader', () => {
  it('builds semicolon-separated CSP string from directives', () => {
    const header = buildCspHeader({
      'default-src': "'self'",
      'img-src': "'self' https:",
    });
    expect(header).toBe("default-src 'self'; img-src 'self' https:");
  });

  it('uses default directives when none provided', () => {
    const header = buildCspHeader();
    expect(header).toContain("default-src 'self'");
    expect(header).toContain("frame-ancestors 'none'");
  });
});

describe('buildCspDirectives', () => {
  it('uses unsafe-inline for styles when no nonce', () => {
    const directives = buildCspDirectives();
    expect(directives['style-src']).toContain("'unsafe-inline'");
    expect(directives['script-src']).toBe("'self'");
  });

  it('uses nonce-based CSP when nonce provided', () => {
    const directives = buildCspDirectives('abc123');
    expect(directives['script-src']).toBe("'self' 'nonce-abc123'");
    expect(directives['style-src']).toBe("'self' 'nonce-abc123'");
  });
});

describe('getSecurityHeaders', () => {
  it('always includes base security headers', () => {
    const headers = getSecurityHeaders(true);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('omits HSTS in dev mode', () => {
    const headers = getSecurityHeaders(true);
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('includes HSTS in production', () => {
    const headers = getSecurityHeaders(false);
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
  });

  it('does not include CSP in static headers (CSP is per-request with nonce)', () => {
    const headers = getSecurityHeaders(false);
    expect(headers['Content-Security-Policy']).toBeUndefined();
  });
});

describe('getStaticCacheHeaders', () => {
  it('returns immutable cache headers', () => {
    const headers = getStaticCacheHeaders();
    expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
  });
});
