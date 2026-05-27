/**
 * Static contract test for the admin layout HTTP handlers.
 *
 * Locks two invariants that a regression-prone admin route can violate
 * silently:
 *   1. Every handler under /api/admin/layouts/* gates on BOTH
 *      `requireFeature('admin')` and `requireFeature('layoutEngine')`,
 *      and calls `requireAdmin(event)`. A missing flag check would let
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
    // 8 routes today: index.get + index.post + [id].get + [id].put + [id].delete
    // + [id]/publish.post + [id]/versions/index.get + [id]/versions/[versionId]/revert.post
    // + seed-homepage.post = 9
    expect(handlerFiles.length).toBe(9);
  });

  it.each(handlerFiles.map((f) => [f.replace(handlersRoot + '/', '')]))(
    '%s gates on requireFeature(admin) + requireFeature(layoutEngine) + requireAdmin',
    (relPath) => {
      const src = readFileSync(join(handlersRoot, relPath), 'utf8');
      expect(src, `${relPath}: missing requireFeature('admin')`).toMatch(
        /requireFeature\(\s*['"]admin['"]\s*\)/,
      );
      expect(src, `${relPath}: missing requireFeature('layoutEngine')`).toMatch(
        /requireFeature\(\s*['"]layoutEngine['"]\s*\)/,
      );
      expect(src, `${relPath}: missing requireAdmin(event)`).toMatch(/requireAdmin\s*\(/);
    },
  );
});

describe('admin layout handlers — cache invalidation contract', () => {
  const writeHandlers = handlerFiles.filter((f) => /\.(post|put|delete|patch)\.ts$/.test(f));

  it('discovers the expected write handlers', () => {
    // index.post + [id].put + [id].delete + publish.post + revert.post + seed-homepage.post = 6
    expect(writeHandlers.length).toBe(6);
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
