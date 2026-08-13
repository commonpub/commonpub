import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fnv1a32 } from '../digest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const COMPOSABLE = resolve(REPO_ROOT, 'layers/base/composables/useCookieConsent.ts');
const OUR_COPY = resolve(HERE, '../digest.ts');

/**
 * Pull the FNV-1a body out of a source file: the lines from the seed to the
 * base36 return, trimmed and joined. Name-independent, comment-independent and
 * indentation-independent, so it compares the ALGORITHM rather than the prose
 * around it.
 */
function extractFnvBody(source: string): string {
  const lines = source.split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => l.includes('0x811c9dc5'));
  const end = lines.findIndex((l) => l.includes("h.toString(36)"));
  if (start === -1 || end === -1 || end < start) return '';
  return lines.slice(start, end + 1).join('\n');
}

describe('fnv1a32 is byte-identical to the cookie consent digest', () => {
  /**
   * Section 14.4 deliberately did NOT lift `scopeDigest` out of
   * `useCookieConsent.ts`: editing that file risks changing the cookie scope
   * digest, which silently invalidates every stored consent on all three
   * instances and forces a global re-prompt. The price of the copy is this
   * test, which fails the moment either implementation drifts.
   */
  it('reproduces the composable’s implementation line for line', () => {
    const composableSource = readFileSync(COMPOSABLE, 'utf8');
    const ourSource = readFileSync(OUR_COPY, 'utf8');

    // Guard the guard: a moved or renamed file must fail red, not scan nothing.
    expect(composableSource.length).toBeGreaterThan(500);
    expect(composableSource).toContain('function scopeDigest(');

    const theirs = extractFnvBody(composableSource);
    const ours = extractFnvBody(ourSource);
    expect(theirs.split('\n').length).toBeGreaterThanOrEqual(7);
    expect(ours).toBe(theirs);
  });

  it('pins the exact digest values, so editing BOTH copies still fails', () => {
    // Locked contract. These are the values the live cookie relies on: every
    // stored `cpub-consent=<level>|<scope>` on commonpub.io, deveco.io and
    // heatsync was written against this function. A change here is a change to
    // what every one of those visitors is deemed to have agreed to.
    expect(fnv1a32([])).toBe('ztntfp');
    expect(fnv1a32([''])).toBe('ztntfp');
    expect(fnv1a32(['1'])).toBe('efwnq4');
    expect(fnv1a32(['1', 'analytics:Google Ireland Limited'])).toBe('qm35rk');
    expect(fnv1a32(['1', 'analytics:Google Ireland Limited', 'functional:CommonPub'])).toBe(
      '11wmlv7',
    );
    expect(fnv1a32(['2', 'analytics:Plausible Insights OU'])).toBe('71xhw9');
    expect(fnv1a32(['cpub-color-scheme'])).toBe('17bhnhd');
  });

  it('is order sensitive and pure', () => {
    expect(fnv1a32(['a', 'b'])).not.toBe(fnv1a32(['b', 'a']));
    expect(fnv1a32(['x'])).toBe(fnv1a32(['x']));
  });

  it('concatenates parts, which is why callers must tag them', () => {
    // Documented property, not a bug: the parts are hashed as one stream, so
    // ['a','b'] and ['ab'] collide. Every caller in this package prefixes each
    // part with its group, which is what keeps a recipient id from colliding
    // with a field key.
    expect(fnv1a32(['a', 'b'])).toBe(fnv1a32(['ab']));
  });
});
