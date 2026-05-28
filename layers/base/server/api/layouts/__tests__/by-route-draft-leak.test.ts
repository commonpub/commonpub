/**
 * Static contract test for the PUBLIC /api/layouts/by-route handler.
 *
 * Locks the P0 invariant from session 160 audit: the endpoint MUST NOT
 * return draft-state layouts to non-admin requesters. The check is a
 * source-string read because a full PGlite + SSR test harness for this
 * specific handler isn't yet wired (the handler uses h3 + nitro + DB +
 * better-auth context — too many moving parts for a fast unit test).
 *
 * The test verifies three load-bearing fragments of the fix are
 * present in the handler source. If any are removed by a refactor,
 * this test fails red — surfacing the regression before it leaks.
 *
 * Promote to a full integration test when the editor's auto-save E2E
 * test harness lands (Phase 3 wrap).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const handlerPath = resolve(__dirname, '..', 'by-route.get.ts');
const src = readFileSync(handlerPath, 'utf8');

describe('GET /api/layouts/by-route — draft-leak P0 guard', () => {
  it('reads the requesting user via getOptionalUser (non-throwing)', () => {
    expect(src, 'must call getOptionalUser(event) — required for the admin check').toMatch(
      /getOptionalUser\(\s*event\s*\)/,
    );
  });

  it('checks user.role === "admin" to differentiate draft visibility', () => {
    expect(src, 'must derive isAdmin from user.role === "admin"').toMatch(
      /user\?\.role\s*===\s*['"]admin['"]/,
    );
  });

  it('only returns the layout when state === "published" OR caller is admin', () => {
    // The fix's defining condition: `isAdmin || layout.state === 'published'`
    expect(src, 'must guard the response on isAdmin || layout.state === "published"').toMatch(
      /isAdmin\s*\|\|\s*layout\.state\s*===\s*['"]published['"]/,
    );
  });

  it('trifurcates the cache key on access tier (no cross-contamination)', () => {
    // Round-3 audit: 3-way split admin / members / anon so a
    // higher-tier response can't leak to a lower-tier hit on the same path.
    expect(src, 'must derive a 3-way tier for cache-key bifurcation').toMatch(
      /tier.*admin.*members.*anon|admin.*members.*anon/s,
    );
  });

  it('reads pageMeta.access to gate members/admin pages', () => {
    expect(src, 'must read pageMeta.access for the access-tier guard').toMatch(
      /pageMeta\?\.access|pageMeta\.access/,
    );
  });
});
