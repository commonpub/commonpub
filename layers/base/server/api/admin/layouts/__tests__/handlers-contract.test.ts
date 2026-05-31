/**
 * Static contract test for the admin layout HTTP handlers.
 *
 * Locks two invariants that a regression-prone admin route can violate
 * silently:
 *   1. Every handler under /api/admin/layouts/* gates on BOTH
 *      `requireFeature('admin')` and `requireFeature('layoutEngine')`,
 *      and gates on `requirePermission(event, 'layout.manage')` (the
 *      Phase-1 RBAC migration of the former `requireAdmin(event)` — the
 *      specific key is asserted so a future edit can't silently regrant
 *      the surface to a different capability). A missing flag check would let
 *      the endpoints exist even when the engine is off (bypasses the
 *      "no feature without a flag" CLAUDE.md rule). A missing auth
 *      check would expose layout writes to unauthenticated requests.
 *   2. Every WRITE handler (.post / .put / .delete) calls
 *      `invalidateLayoutsByRouteCache()` after the mutation. Per
 *      feedback_integration_test_full_output_path: a write that doesn't
 *      invalidate serves stale data via SSR for up to TTL_MS.
 *
 * The check is a static read of each handler file's source. Cheap and
 * catches the most common refactor regression (forgot to add the call
 * on a new endpoint) without needing a full nitro test harness.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const handlersRoot = resolve(__dirname, '..');

function walkHandlers(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkHandlers(full));
    } else if (/\.(get|post|put|delete|patch)\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const handlerFiles = walkHandlers(handlersRoot);

describe('admin layout handlers — security contract', () => {
  it('discovers handlers across the admin/layouts subtree', () => {
    // index.get + index.post + [id].get + [id].put + [id].delete
    // + [id]/publish.post + [id]/versions/index.get + [id]/versions/[versionId]/revert.post
    // + seed-homepage.post (session 158)
    // + migrate-homepage.post (session 159) = 10
    expect(handlerFiles.length).toBe(10);
  });

  it.each(handlerFiles.map((f) => [f.replace(handlersRoot + '/', '')]))(
    '%s gates on requireFeature(admin) + requireFeature(layoutEngine) + requirePermission(layout.manage)',
    (relPath) => {
      const src = readFileSync(join(handlersRoot, relPath), 'utf8');
      expect(src, `${relPath}: missing requireFeature('admin')`).toMatch(
        /requireFeature\(\s*['"]admin['"]\s*\)/,
      );
      expect(src, `${relPath}: missing requireFeature('layoutEngine')`).toMatch(
        /requireFeature\(\s*['"]layoutEngine['"]\s*\)/,
      );
      expect(src, `${relPath}: missing requirePermission(event, 'layout.manage')`).toMatch(
        /requirePermission\(\s*event\s*,\s*['"]layout\.manage['"]\s*\)/,
      );
    },
  );
});

describe('admin layout handlers — optimistic concurrency contract', () => {
  // Phase 3a.6: the PUT handler must honor an If-Match header so the
  // editor's auto-save can detect cross-session conflicts. Other write
  // handlers (POST/DELETE/publish/revert/seed/migrate) operate on different
  // semantics (creation, terminal state changes, batch migrations) and
  // don't need If-Match in v1 — locked here so we revisit deliberately.
  const putHandlers = handlerFiles.filter((f) => /\.put\.ts$/.test(f));

  it('discovers the PUT handlers', () => {
    expect(putHandlers.length).toBeGreaterThan(0);
  });

  it.each(putHandlers.map((f) => [f.replace(handlersRoot + '/', '')]))(
    '%s honors If-Match header (returns 409 on mismatch)',
    (relPath) => {
      const src = readFileSync(join(handlersRoot, relPath), 'utf8');
      // Reads the header
      expect(src, `${relPath}: missing getHeader(event, 'if-match')`).toMatch(
        /getHeader\(\s*event\s*,\s*['"]if-match['"]\s*\)/i,
      );
      // Throws 409 on mismatch
      expect(src, `${relPath}: missing 409 statusCode for If-Match mismatch`).toMatch(
        /statusCode:\s*409/,
      );
    },
  );
});

describe('admin layout handlers — cache invalidation contract', () => {
  const writeHandlers = handlerFiles.filter((f) => /\.(post|put|delete|patch)\.ts$/.test(f));

  it('discovers the expected write handlers', () => {
    // index.post + [id].put + [id].delete + publish.post + revert.post
    // + seed-homepage.post + migrate-homepage.post = 7
    expect(writeHandlers.length).toBe(7);
  });

  it.each(writeHandlers.map((f) => [f.replace(handlersRoot + '/', '')]))(
    '%s calls invalidateLayoutsByRouteCache()',
    (relPath) => {
      const src = readFileSync(join(handlersRoot, relPath), 'utf8');
      expect(src, `${relPath}: missing invalidateLayoutsByRouteCache() call`).toMatch(
        /invalidateLayoutsByRouteCache\s*\(\s*\)/,
      );
    },
  );
});

/*
 * Audit log contract (session 163 deep audit):
 * EVERY write handler must emit at least one `cpub.audit.layout.*`
 * structured log line so operators can grep the forensic trail. The
 * audit gap caught: PUT only logged force-save + config-rejected, not
 * regular auto-saves — meaning a normal admin update left zero trail.
 * Fix landed alongside this contract test. Future regression: adding
 * a new write endpoint that doesn't log → red.
 */
describe('admin layout handlers — audit log contract', () => {
  const writeHandlers = handlerFiles.filter((f) => /\.(post|put|delete|patch)\.ts$/.test(f));

  it.each(writeHandlers.map((f) => [f.replace(handlersRoot + '/', '')]))(
    '%s emits at least one cpub.audit.layout.* log line',
    (relPath) => {
      const src = readFileSync(join(handlersRoot, relPath), 'utf8');
      expect(src, `${relPath}: missing cpub.audit.layout.* console.info`).toMatch(
        /console\.info\(\s*['"]cpub\.audit\.layout\./,
      );
    },
  );
});
