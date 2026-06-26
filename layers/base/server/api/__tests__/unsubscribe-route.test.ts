/**
 * Static contract test for POST /api/unsubscribe (email Phase 1b).
 *
 * Locks the security shape: token-authenticated (NOT session-auth — it must work
 * cross-origin from a mail client), verifies the HMAC, and MERGES the existing
 * prefs rather than clobbering them. Source-string read (same pattern as
 * entries-score-gating.test.ts) since a full nitro harness for this route isn't wired.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(__dirname, '..', 'unsubscribe.post.ts'), 'utf8');

describe('POST /api/unsubscribe — contract', () => {
  it('is token-authenticated, not session-authenticated', () => {
    expect(src, 'must verify the HMAC token').toMatch(/verifyUnsubscribeToken\(/);
    expect(src, 'must NOT require a logged-in session').not.toMatch(/requireAuth\(/);
    expect(src, 'rejects an invalid token with 400').toMatch(/statusCode:\s*400/);
  });

  it('merges existing prefs instead of clobbering them', () => {
    expect(src, 'must spread the current prefs').toMatch(/\.\.\.current/);
    expect(src, "must set unsubscribedAll for the 'all' scope").toMatch(/unsubscribedAll:\s*true/);
    expect(src, "must force digest to 'none'").toMatch(/digest:\s*'none'/);
  });
});
