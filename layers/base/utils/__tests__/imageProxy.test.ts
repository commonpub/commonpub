import { describe, it, expect } from 'vitest';
import { proxiedImageUrl } from '../imageProxy';

const DOMAIN = 'example.com';
const enc = (u: string) => encodeURIComponent(u);

describe('proxiedImageUrl', () => {
  it('returns null for empty input', () => {
    expect(proxiedImageUrl(null, DOMAIN)).toBeNull();
    expect(proxiedImageUrl(undefined, DOMAIN)).toBeNull();
    expect(proxiedImageUrl('', DOMAIN)).toBeNull();
  });

  it('serves a RELATIVE url directly — never proxies it (regression: /favicon.svg 400)', () => {
    expect(proxiedImageUrl('/favicon.svg', DOMAIN)).toBe('/favicon.svg');
    expect(proxiedImageUrl('/uploads/cover.png', 'localhost:3000')).toBe('/uploads/cover.png');
  });

  it('serves data/blob/http URIs directly (proxy is HTTPS-only)', () => {
    expect(proxiedImageUrl('data:image/png;base64,AAAA', DOMAIN)).toBe('data:image/png;base64,AAAA');
    expect(proxiedImageUrl('http://remote.example.org/x.jpg', DOMAIN)).toBe('http://remote.example.org/x.jpg');
  });

  it('serves same-origin HTTPS images directly', () => {
    expect(proxiedImageUrl('https://example.com/uploads/x.jpg', DOMAIN)).toBe('https://example.com/uploads/x.jpg');
    // site domain may carry a port/scheme in config — still same-origin by host
    expect(proxiedImageUrl('https://localhost/uploads/x.jpg', 'localhost:3000')).toBe('https://localhost/uploads/x.jpg');
  });

  it('PROXIES a hostile look-alike host (no substring same-origin bypass → no IP leak)', () => {
    const evil = 'https://example.com.evil.com/track.jpg';
    expect(proxiedImageUrl(evil, DOMAIN)).toBe(`/api/image-proxy?url=${enc(evil)}&w=600`);
    const evil2 = 'https://evil.com/example.com.jpg';
    expect(proxiedImageUrl(evil2, DOMAIN)).toBe(`/api/image-proxy?url=${enc(evil2)}&w=600`);
  });

  it('proxies remote HTTPS images', () => {
    const u = 'https://picsum.photos/id/1062/400/300';
    expect(proxiedImageUrl(u, DOMAIN)).toBe(`/api/image-proxy?url=${enc(u)}&w=600`);
    expect(proxiedImageUrl(u, DOMAIN, 900)).toBe(`/api/image-proxy?url=${enc(u)}&w=900`);
  });

  it('proxies remote HTTPS when the site domain is unset (can\'t detect same-origin)', () => {
    const u = 'https://remote.example.com/img/cover.jpg';
    expect(proxiedImageUrl(u, '')).toBe(`/api/image-proxy?url=${enc(u)}&w=600`);
  });
});
