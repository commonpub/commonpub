import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

/**
 * The root README's package table is the project's front door, and it had
 * rotted silently: on 2026-08-30 THIRTEEN of its fifteen version cells were
 * wrong, `@commonpub/persona` was missing entirely, `@commonpub/theme-studio`
 * was still marked "not yet published" nine minor versions after it shipped,
 * and the prose said "12 published ... = 13 total" when there were 14.
 *
 * Nothing failed when that drifted, because nothing read it. A version cell is
 * a hand-copied duplicate of `package.json`, which is exactly the shape this
 * repo keeps getting caught by: the number is written twice, one copy moves,
 * and the stale copy is the one strangers read first.
 *
 * This guard DISCOVERS the packages by listing `packages/`, rather than
 * carrying a list of its own. A package added tomorrow and left out of the
 * README fails here; a list would have to be remembered, which is the same
 * failure again one level up.
 *
 * It lives in the layer because that is where this repo's other repo-wide
 * parity guard already lives (`composables/__tests__/featureFlagParity.test.ts`
 * reaches the same repo root the same way), and because the layer's `test`
 * task is one of the ones CI actually runs. It ships in no tarball: the
 * layer's `files` whitelist in `package.json` does not include `__tests__/`,
 * and `.npmignore` excludes it a second time.
 *
 * Following that same guard's practice, this one carries its own guards: it
 * asserts it discovered at least MIN_PACKAGES packages and parsed at least
 * that many README rows, and it pins the row parser against a known-good and
 * a known-bad line. A regex that silently stops matching would otherwise make
 * every assertion below pass over an empty set.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const README = join(repoRoot, 'README.md');
const PACKAGES_DIR = join(repoRoot, 'packages');
const LAYER_PKG = join(repoRoot, 'layers/base/package.json');

/**
 * Floor, not the count. 14 packages exist today. Written once, here; read by
 * the assertions rather than restated, so raising it is a single edit.
 */
const MIN_PACKAGES = 14;

/** `| [`@commonpub/schema`](packages/schema/README.md) | 0.66.0 | ... |` */
const ROW = /^\|\s*\[`@commonpub\/([a-z-]+)`\]\([^)]*\)\s*\|\s*([0-9]+\.[0-9]+\.[0-9]+)\s*\|/;
/** The layer is listed in its own table, without a link. */
const LAYER_ROW = /^\|\s*`@commonpub\/layer`\s*\|\s*([0-9]+\.[0-9]+\.[0-9]+)\s*\|/;

function readmeVersions(): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of readFileSync(README, 'utf8').split('\n')) {
    const m = ROW.exec(line);
    if (m) out.set(m[1]!, m[2]!);
  }
  return out;
}

/** Every non-private package under `packages/`, discovered by listing. */
function workspacePackages(): Map<string, string> {
  const out = new Map<string, string>();
  for (const dir of readdirSync(PACKAGES_DIR)) {
    const pkgPath = join(PACKAGES_DIR, dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      name?: string; version?: string; private?: boolean;
    };
    if (pkg.private === true) continue;
    if (!pkg.name?.startsWith('@commonpub/') || !pkg.version) continue;
    out.set(pkg.name.replace('@commonpub/', ''), pkg.version);
  }
  return out;
}

describe('the README parser still works', () => {
  it('matches a real row and rejects a near-miss', () => {
    expect(ROW.exec('| [`@commonpub/schema`](packages/schema/README.md) | 0.66.0 | 110 tables |')?.[2])
      .toBe('0.66.0');
    // No version cell: must not match, or a table that lost its versions
    // would parse as zero rows and every check below would pass vacuously.
    expect(ROW.exec('| [`@commonpub/schema`](packages/schema/README.md) | | 110 tables |')).toBeNull();
    expect(LAYER_ROW.exec('| `@commonpub/layer` | 0.137.4 | Shared Nuxt layer |')?.[1]).toBe('0.137.4');
  });

  it('found the files it means to read', () => {
    expect(existsSync(README)).toBe(true);
    expect(existsSync(LAYER_PKG)).toBe(true);
  });
});

describe('README package table matches package.json', () => {
  const onDisk = workspacePackages();
  const inReadme = readmeVersions();

  it('discovered every workspace package and every README row', () => {
    expect(onDisk.size).toBeGreaterThanOrEqual(MIN_PACKAGES);
    expect(inReadme.size).toBeGreaterThanOrEqual(MIN_PACKAGES);
  });

  it('lists every published package', () => {
    const missing = [...onDisk.keys()].filter((n) => !inReadme.has(n)).sort();
    expect(missing, `packages absent from the README table: ${missing.join(', ')}`).toEqual([]);
  });

  it('lists no package that does not exist', () => {
    const extra = [...inReadme.keys()].filter((n) => !onDisk.has(n)).sort();
    expect(extra, `README lists packages not in packages/: ${extra.join(', ')}`).toEqual([]);
  });

  it('states the current version for each one', () => {
    const drift: string[] = [];
    for (const [name, version] of onDisk) {
      const claimed = inReadme.get(name);
      if (claimed && claimed !== version) drift.push(`${name}: README ${claimed} != package.json ${version}`);
    }
    expect(drift, drift.join('; ')).toEqual([]);
  });

  it('states the current layer version', () => {
    const layerVersion = (JSON.parse(readFileSync(LAYER_PKG, 'utf8')) as { version: string }).version;
    const claimed = readFileSync(README, 'utf8').split('\n')
      .map((l) => LAYER_ROW.exec(l)?.[1]).find(Boolean);
    expect(claimed, 'no `@commonpub/layer` row found in the README').toBeTruthy();
    expect(claimed).toBe(layerVersion);
  });
});
