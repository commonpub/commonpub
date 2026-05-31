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

  it('derives draft visibility from the layout.manage permission', () => {
    // Phase-1 RBAC: the former `user?.role === 'admin'` is now
    // `hasPermission(event, 'layout.manage')`. Flag-off this is identical
    // (admins pass via the gate's admin floor); flag-on a layout.manage
    // grant also sees drafts + the admin cache tier — the intended broadening.
    expect(src, 'must derive isAdmin from hasPermission(event, "layout.manage")').toMatch(
      /hasPermission\(\s*event\s*,\s*['"]layout\.manage['"]\s*\)/,
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

describe('GET /api/layouts/by-route — path normalization (session 163 audit)', () => {
  it('normalizes trailing slashes so /blog and /blog/ hit the same cache + DB', () => {
    // Without this, `/blog` and `/blog/` create separate cache entries
    // AND the second can silently miss the DB record stored under the
    // first. The deep audit caught both as P2 (Agent E + Agent B).
    expect(src, 'must strip trailing slashes from the request path before lookup').toMatch(
      /replace\(\s*\/\\\/\+\$\/\s*,\s*['"]['"]\s*\)/,
    );
  });

  it('preserves the root path "/" (no slash to strip)', () => {
    // The strip pattern must special-case the root so '/' doesn't become ''.
    expect(src, 'must not strip the leading slash from the root path').toMatch(
      /rawPath\s*===\s*['"]\/['"]/,
    );
  });
});
