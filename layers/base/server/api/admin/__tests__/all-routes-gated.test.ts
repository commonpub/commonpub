/**
 * INV-6 — every admin route is gated (source-contract sweep).
 *
 * RBAC routes all instance-wide authorization through one choke-point
 * (`requireAdmin` → `requirePermission(event, 'admin.access')`, reimplemented in
 * session 175). This test fs-enumerates EVERY handler under
 * `server/api/admin/**` and asserts each calls a permission guard — `requireAdmin(`
 * OR `requirePermission(`. It locks the surface so the Phase 1 mechanical
 * migration (requireAdmin → requirePermission('<key>')) can't silently drop a
 * guard on any endpoint, and so a newly-added admin route can't ship ungated.
 *
 * Static source read (like handlers-contract.test.ts) — cheap, no Nitro harness,
 * catches the common regression. INV-7's "every catalog key maps to the admin
 * role" half waits for the Phase 2 seed; the referenced-key-in-catalog half is
 * compile-enforced by requirePermission's `PermissionKey` param.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PERMISSIONS } from '@commonpub/schema';

const adminRoot = resolve(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(get|post|put|delete|patch)\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const handlers = walk(adminRoot);

describe('INV-6 — every admin route calls a permission guard', () => {
  it('discovers the admin handler surface', () => {
    // Sanity floor — if this drops sharply, route discovery (or the tree) broke.
    expect(handlers.length).toBeGreaterThanOrEqual(60);
  });

  it.each(handlers.map((f) => [f.replace(adminRoot + '/', ''), f]))(
    'admin/%s gates on requireAdmin() or requirePermission()',
    (_rel, full) => {
      const src = readFileSync(full, 'utf8');
      expect(/requireAdmin\(|requirePermission\(/.test(src)).toBe(true);
    },
  );
});

describe('INV-7 — referenced permission keys exist in the catalog', () => {
  it('every requirePermission("<key>") literal across server code is a catalog key', () => {
    const searchRoots = [
      resolve(__dirname, '..', '..', '..'), // layers/base/server
    ];
    const offenders: string[] = [];
    const fileWalk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          // Skip test dirs: contract tests legitimately contain
          // `requirePermission(event, '<key>')` / `'${key}'` pattern-strings
          // that are NOT real key references (this is a HANDLER-source sweep).
          if (entry === '__tests__' || entry === 'node_modules' || entry === '.output' || entry === '.nuxt') continue;
          out.push(...fileWalk(full));
        } else if (entry.endsWith('.ts')) out.push(full);
      }
      return out;
    };
    const literalRe = /requirePermission\(\s*event\s*,\s*['"]([^'"]+)['"]/g;
    for (const root of searchRoots) {
      for (const file of fileWalk(root)) {
        const src = readFileSync(file, 'utf8');
        let m: RegExpExecArray | null;
        while ((m = literalRe.exec(src)) !== null) {
          const key = m[1]!;
          if (!(PERMISSIONS as readonly string[]).includes(key)) {
            offenders.push(`${file}: '${key}'`);
          }
        }
      }
    }
    expect(offenders, `unknown permission keys referenced:\n${offenders.join('\n')}`).toEqual([]);
  });
});
