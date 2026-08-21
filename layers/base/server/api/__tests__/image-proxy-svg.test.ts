/**
 * WIRING guard for the image proxy's SVG neutralization.
 *
 * `GET /api/image-proxy?url=…` takes any HTTPS URL from an anonymous caller and
 * returned the bytes with the upstream Content-Type. `image/svg+xml` passed the
 * `startsWith('image/')` gate, so an attacker-hosted SVG carrying `<script>` was
 * served from this instance's origin — same-origin script execution against a
 * logged-in visitor, reachable with a link.
 *
 * `nosniff` does not help (the content type is honest) and the page CSP is not
 * applied to API responses, which is why the route must set the policy itself.
 *
 * SVG is neutralized rather than REFUSED on purpose: the only consumers are
 * `<img>` and CSS `background-image` on content cards, neither of which executes
 * SVG script, so refusing it would break federated vector covers for no gain.
 *
 * Source-level, matching `files/__tests__/private-files-route.test.ts`: booting
 * Nitro and standing up a hostile upstream is not worth it to pin a header.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(__dirname, '..', 'image-proxy.get.ts'), 'utf8');
const serveFile = readFileSync(resolve(__dirname, '../../utils/serveFile.ts'), 'utf8');

describe('image-proxy neutralizes scriptable image types', () => {
  it('sends a sandboxing CSP on every response', () => {
    expect(route).toMatch(/'Content-Security-Policy': NEUTRALIZE_CSP/);
    expect(route).toMatch(/const NEUTRALIZE_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"/);
  });

  it('uses the same policy as the stored-file path, so the two cannot drift', () => {
    const pick = (src: string): string | undefined =>
      src.match(/"default-src 'none'; style-src 'unsafe-inline'; sandbox"/)?.[0];
    expect(pick(route)).toBeDefined();
    expect(pick(route)).toBe(pick(serveFile));
  });

  it('still serves SVG rather than refusing it, so federated vector covers keep working', () => {
    expect(route).not.toMatch(/statusCode: 415/);
  });

  it('strips parameters before matching, so `image/svg+xml; charset=utf-8` is handled', () => {
    expect(route).toMatch(/contentType\.split\(';'\)\[0\]!?\.trim\(\)\.toLowerCase\(\)/);
  });

  it('sends the normalized mime, not the upstream header verbatim', () => {
    expect(route).toMatch(/'Content-Type': mime,/);
    expect(route).not.toMatch(/'Content-Type': contentType,/);
  });

  it('carries nosniff alongside the CSP', () => {
    expect(route).toMatch(/'X-Content-Type-Options': 'nosniff'/);
  });

  it('still enforces HTTPS and the image/ prefix', () => {
    expect(route).toMatch(/parsed\.protocol !== 'https:'/);
    expect(route).toMatch(/!mime\.startsWith\('image\/'\)/);
  });

  // Positive control.
  it('read the files it claims to check', () => {
    expect(route.length).toBeGreaterThan(1500);
    expect(serveFile.length).toBeGreaterThan(500);
  });
});
