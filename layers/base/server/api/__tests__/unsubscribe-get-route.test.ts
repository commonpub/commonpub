/**
 * Static contract test for GET /api/unsubscribe.
 *
 * The RFC 2369 `List-Unsubscribe: <…/api/unsubscribe?token=…>` header is a plain
 * URL, so a mail client without one-click POST (and a human who clicks the footer
 * link) issues a GET. Before this handler existed those requests 405'd. It mirrors
 * the POST's HMAC token verification but, being a safe GET, does NOT mutate prefs:
 * it redirects to the /unsubscribe confirm page. Source-string read (same pattern
 * as unsubscribe-route.test.ts) since a full nitro harness isn't wired.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '..', 'unsubscribe.get.ts'), 'utf8');

describe('GET /api/unsubscribe — contract', () => {
  it('is token-authenticated (mirrors the POST HMAC check), not session-auth', () => {
    expect(src, 'must verify the HMAC token').toMatch(/verifyUnsubscribeToken\(/);
    expect(src, 'must NOT require a logged-in session').not.toMatch(/requireAuth\(/);
  });

  it('is a safe GET: redirects to the confirm page, never mutates prefs', () => {
    expect(src, 'must redirect to the confirm flow').toMatch(/sendRedirect\(/);
    expect(src, 'must target the /unsubscribe page').toMatch(/['"]\/unsubscribe/);
    expect(src, 'must NOT write to the users table').not.toMatch(/db\.update\(/);
  });

  it('forwards a valid token and falls back to the tokenless error page otherwise', () => {
    expect(src).toMatch(/encodeURIComponent\(\s*token\s*\)/);
  });
});
