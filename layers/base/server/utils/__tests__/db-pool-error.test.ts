/**
 * Guards every LONG-LIVED Postgres pool in the repo against the uncaught-exception
 * crash — the layer, `packages/server/src`, and both apps' server trees.
 *
 * THE MECHANISM. In Node, an `'error'` event emitted on an EventEmitter that has
 * no listener for it is re-thrown as an uncaught exception. `pg.Pool` emits
 * `'error'` on behalf of an IDLE client whenever the backend closes the
 * connection underneath it: a Postgres restart, a failover, an administrative
 * `pg_terminate_backend`, an idle-connection reaper, or a network blip. A pool
 * with no listener therefore turns a routine database hiccup into a process-wide
 * crash — in production that is the whole Nitro server, mid-request, for every
 * visitor.
 *
 * WHY THIS FILE EXISTS. Session 256 diagnosed this exact mechanism after it made
 * a run of 2,138 PASSING server tests exit 1, and fixed it — in the four pools of
 * the test helper (`packages/server/src/__tests__/helpers/realpgdb.ts`). The pool
 * in `../db.ts`, the only one that serves production, was not part of that fix.
 * So this guard asserts the property over every pool in every long-lived server
 * tree, found by SCANNING, rather than over the one that happened to be noticed.
 * (The first version of this file scanned only `layers/base/server/` — which is
 * where the defect was — and would have missed a pool added to
 * `packages/server/src`. Same mistake, one level up.)
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SERVER_ROOT = resolve(__dirname, '..', '..');
const REPO_ROOT = resolve(SERVER_ROOT, '..', '..', '..');

/**
 * Every tree that can hold a LONG-LIVED pool — one owned by a process that must
 * survive a transient database error.
 *
 * Deliberately NOT included: `scripts/*.mjs` and `apps/reference/scripts/seed.ts`.
 * Those are one-shot CLI tools (`db-migrate`, `reconcile-counters`,
 * `migrate-homepage-layout`, `seed`) that open a pool, do their work and call
 * `pool.end()`. For them an uncaught 'error' means a non-zero exit, which for a
 * migration runner is the CORRECT behaviour — you want it to fail loudly, not
 * swallow a connection fault and report success. The hazard this file guards is
 * specific to a server that is supposed to stay up.
 */
const LONG_LIVED_ROOTS = [
  SERVER_ROOT,
  resolve(REPO_ROOT, 'packages', 'server', 'src'),
  resolve(REPO_ROOT, 'apps', 'reference', 'server'),
  resolve(REPO_ROOT, 'apps', 'shell', 'server'),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(p, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

const POOL_CTOR = /new\s+(?:pg\.)?Pool\s*\(/;

function safeWalk(dir: string): string[] {
  try { return walk(dir); } catch { return []; }
}

const scanned = LONG_LIVED_ROOTS.flatMap(safeWalk);

const poolFiles = scanned
  .map((file) => ({ file: file.slice(REPO_ROOT.length + 1), src: readFileSync(file, 'utf8') }))
  .filter(({ src }) => POOL_CTOR.test(src));

describe('the mechanism this guard is about', () => {
  it("an 'error' event with no listener throws", () => {
    const bare = new EventEmitter();
    expect(() => bare.emit('error', new Error('backend went away'))).toThrow('backend went away');
  });

  it("the same event with a listener does not", () => {
    const guarded = new EventEmitter();
    const seen: Error[] = [];
    guarded.on('error', (e: Error) => seen.push(e));
    expect(() => guarded.emit('error', new Error('backend went away'))).not.toThrow();
    expect(seen).toHaveLength(1);
  });
});

describe('every pg Pool the layer creates has an error listener', () => {
  it('found at least one pool to check', () => {
    // Without this the it.each below iterates zero cases and passes vacuously.
    expect(poolFiles.length).toBeGreaterThan(0);
    expect(poolFiles.map((f) => f.file)).toContain('layers/base/server/utils/db.ts');
  });

  it.each(poolFiles.map((f) => f.file))('%s attaches pool.on("error", …)', (file) => {
    const { src } = poolFiles.find((f) => f.file === file)!;
    expect(src).toMatch(/\.on\(\s*['"]error['"]\s*,/);
  });

  it('the listener is attached before the pool is handed to drizzle', () => {
    // Ordering matters: a pool passed to drizzle and used before the listener is
    // attached can emit into the gap. Assert the listener line precedes the
    // drizzle() call in the one file that does both.
    const db = poolFiles.find((f) => f.file === 'layers/base/server/utils/db.ts');
    expect(db).toBeDefined();
    const onError = db!.src.search(/\.on\(\s*['"]error['"]\s*,/);
    const toDrizzle = db!.src.search(/drizzle\(\s*pool/);
    expect(onError).toBeGreaterThan(-1);
    expect(toDrizzle).toBeGreaterThan(-1);
    expect(onError).toBeLessThan(toDrizzle);
  });
});

// Positive control: a rename or move would otherwise make the scan return nothing
// and every assertion above pass by iterating zero files.
describe('the guard read what it claims to', () => {
  it('walked every long-lived root, not just the layer', () => {
    expect(scanned.length).toBeGreaterThan(100);
    // If a root path is ever wrong, safeWalk() swallows it and the scan silently
    // shrinks. Assert the two roots that must ALWAYS have files actually contributed.
    //
    // Deliberately not asserting on the apps/ roots: `apps/shell/server` holds a
    // single file today, and a guard that fails when a starter template loses its
    // last server file would be reporting a problem that does not exist. The
    // required roots below are enough to catch a broken path.
    for (const root of [SERVER_ROOT, resolve(REPO_ROOT, 'packages', 'server', 'src')]) {
      expect(safeWalk(root).length, `${root} contributed no files`).toBeGreaterThan(0);
    }
    expect(scanned.some((f) => f.includes('/packages/server/src/'))).toBe(true);
  });

  it('read a real db.ts', () => {
    const db = poolFiles.find((f) => f.file === 'layers/base/server/utils/db.ts');
    expect(db!.src).toContain('connectionString');
    expect(db!.src.length).toBeGreaterThan(500);
  });
});
