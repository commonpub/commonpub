import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

/**
 * Nitro scans `server/api`, `server/routes`, `server/middleware`, `server/plugins`
 * and `server/utils` and turns what it finds into the server bundle.
 *
 * It SKIPS `*.test.ts`, which is why the long-standing test files under
 * `server/api/__tests__/` and `server/middleware/__tests__/` are harmless. It does
 * NOT skip any other `.ts` file, including one sitting inside a `__tests__`
 * directory. So a shared TEST HELPER named `nitroStubs.ts` gets bundled, and
 * because it imports `vi` from `vitest`, vitest throws "Vitest failed to access
 * its internal state" on import and **every API route in the app returns 500**.
 *
 * That shipped in session 255. `/api/features`, `/api/persona`,
 * `/api/consent/purposes` and every other route 500'd, while `pnpm typecheck`,
 * `pnpm test` and `pnpm lint` were all green, because none of them boots Nitro.
 * Only running the app caught it. The fix was to move the helper to
 * `layers/base/test-helpers/`, which Nitro does not scan.
 *
 * The rule this pins is therefore NOT "no test files under server/" (there are
 * many, legitimately). It is: **a file Nitro will bundle must not reach vitest.**
 */
const SCANNED = ['api', 'routes', 'middleware', 'plugins', 'utils'] as const;

/** Nitro's own skip rule. Everything else in a scanned dir gets bundled. */
const isTestFile = (f: string): boolean => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);

function walk(dir: string): string[] {
  let found: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found = found.concat(walk(full));
    else if (/\.[cm]?tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

const serverRoot = resolve(__dirname, '..');

describe('nothing Nitro bundles can import vitest', () => {
  const bundled = SCANNED.flatMap((d) => walk(join(serverRoot, d))).filter((f) => !isTestFile(f));

  it('walked a realistic number of bundled server modules (P7)', () => {
    // A wrong path walks zero files and every assertion below passes vacuously.
    expect(bundled.length, 'expected to find the real server modules').toBeGreaterThan(100);
  });

  it('no module Nitro bundles imports vitest', () => {
    const offenders = bundled.filter((f) => /from ['"]vitest['"]|require\(['"]vitest['"]\)/.test(readFileSync(f, 'utf8')));
    expect(
      offenders.map((f) => relative(serverRoot, f)),
      'these are bundled into the Nitro server and importing vitest 500s EVERY route. '
      + 'Move shared test helpers to layers/base/test-helpers/, which Nitro does not scan.',
    ).toEqual([]);
  });

  it('the detector matches a real vitest import (positive control)', () => {
    // Without this, a broken regex makes the sweep above vacuous.
    expect(/from ['"]vitest['"]/.test("import { vi } from 'vitest';")).toBe(true);
    expect(/from ['"]vitest['"]/.test("import { x } from './vitestish';")).toBe(false);
  });

  it('the test-file skip matches what Nitro actually skips', () => {
    expect(['a.test.ts', 'b.spec.ts', 'c.test.tsx'].every(isTestFile)).toBe(true);
    expect(isTestFile('nitroStubs.ts')).toBe(false);
  });
});
