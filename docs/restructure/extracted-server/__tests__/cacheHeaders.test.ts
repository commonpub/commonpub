import { describe, it, expect } from 'vitest';
import { getStaticCacheHeaders, getSecurityHeaders } from '../security';

describe('cache headers', () => {
  it('static assets get immutable cache-control', () => {
    const headers = getStaticCacheHeaders();
    expect(headers['Cache-Control']).toContain('immutable');
    expect(headers['Cache-Control']).toContain('max-age=31536000');
  });

  it('production security headers include HSTS with long max-age', () => {
    const headers = getSecurityHeaders(false);
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
  });

  it('dev mode omits HSTS to avoid localhost issues', () => {
    const headers = getSecurityHeaders(true);
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });
});
