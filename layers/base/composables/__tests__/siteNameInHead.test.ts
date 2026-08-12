import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join, relative } from 'node:path';

/**
 * `useSiteName()` must never be called inside a `useSeoMeta` getter.
 *
 * A getter (`title: () => ...`) is evaluated by the head resolver, which runs
 * OUTSIDE the component setup context. `useSiteName()` reads `useState()`, that
 * throws there, and its `catch` returns the `'CommonPub'` fallback. The result
 * is silent and brand-damaging: the instance name is correct everywhere it is
 * resolved eagerly and wrong everywhere it is resolved lazily.
 *
 * Measured on the live deveco.io before the fix:
 *
 *   /privacy   (eager)  ->  "Privacy Policy, devEco.io"     correct
 *   /explore   (eager)  ->  "Explore, devEco.io"            correct
 *   /contests/<slug> (lazy) -> "…Challenge, CommonPub"      WRONG, and this is
 *                                                           the og:title that
 *                                                           unfurls in Slack,
 *                                                           Discord and iMessage
 *                                                           for every contest.
 *
 * `og:site_name` was right the whole time, because the seo-brand plugin
 * resolves it eagerly, which is exactly why the split went unnoticed.
 *
 * This is a structural rule about a call site, so a source scan is the right
 * tool: it is a lint rule that happens to live in the test suite. It carries
 * the two assertions any scanner needs — that it walked real files, and that
 * its matcher still matches — so a broken scan cannot masquerade as a clean one.
 *
 * The durable fix is a `titleTemplate` in the head so pages never append the
 * brand themselves. Until then, resolve in setup and interpolate the string.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SEARCH_DIRS = ['layers/base/pages', 'layers/base/components', 'layers/base/layouts'];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === '__tests__') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.vue')) out.push(p);
  }
  return out;
}

/** A line that both opens an arrow function and calls useSiteName() in it. */
const LAZY_CALL = /=>[^\n]*useSiteName\(\)/;

describe('site name is resolved in setup, not in a head getter', () => {
  it('finds no useSiteName() call inside an arrow-function head value', () => {
    const offenders: string[] = [];
    for (const file of SEARCH_DIRS.flatMap((d) => walk(resolve(repoRoot, d)))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (LAZY_CALL.test(line)) offenders.push(`${relative(repoRoot, file)}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(
      offenders,
      offenders.length
        ? `These resolve the site name inside a head getter, so it silently becomes "CommonPub":\n${offenders.join('\n')}\n\nHoist it: const siteName = useSiteName() in setup, then interpolate siteName.`
        : '',
    ).toEqual([]);
  });

  it('scans a meaningful number of files, so a green result means something', () => {
    const files = SEARCH_DIRS.flatMap((d) => walk(resolve(repoRoot, d)));
    expect(files.length).toBeGreaterThan(100);
  });

  it('detects the pattern it is looking for', () => {
    // Positive control, so a broken regex cannot pass as a clean codebase.
    expect(LAZY_CALL.test('  title: () => `X, ${useSiteName()}`,')).toBe(true);
    expect(LAZY_CALL.test('const siteName = useSiteName();')).toBe(false);
    expect(LAZY_CALL.test('  title: `X, ${useSiteName()}`,')).toBe(false);
  });
});
