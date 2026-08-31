import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join, relative, sep } from 'node:path';

/**
 * No credential may enter the Docker build context.
 *
 * `Dockerfile` line 13 is `COPY . .`, so every file the daemon receives lands
 * in a build-stage layer. On 2026-08-30 two live credentials were doing exactly
 * that: `.secrets/cargo-registry-token` (the crates.io publish token, P1-8 in
 * the 2026-08-23 audit) and `secrets/CPUB_FED_TOKEN_KEYS.md`, which the audit
 * had not spotted at all.
 *
 * Both slipped through rules that LOOK like they cover them. `.env*` matches
 * only the root `.env` family. `*.md` matches only ROOT-level markdown, because
 * Docker matches a pattern against the whole relative path and `*` does not
 * cross a `/` -- so `secrets/CPUB_FED_TOKEN_KEYS.md` was never a candidate.
 * That is the trap this test exists to hold shut: a rule that reads as general
 * and is not.
 *
 * It DISCOVERS credentials by scanning rather than naming the two that exist,
 * so a third one added tomorrow fails here.
 *
 * The matcher below is a deliberate subset of Docker's pattern language --
 * enough for the rule forms this file actually uses. It is pinned in its own
 * describe block against cases that were verified by really running
 * `docker build` against a throwaway context: `README.md` and `docs/thing.md`
 * excluded, `index.js` and `package.json` kept, and (before the fix) both
 * credential paths copied in.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DOCKERIGNORE = join(repoRoot, '.dockerignore');

/** Floor, not the count. Two credential files exist today. */
const MIN_CREDENTIALS = 2;

/** Directory names whose entire contents are credentials by convention. */
const SECRET_DIRS = new Set(['secrets', '.secrets']);
/** Extensions that are private key material wherever they appear. */
const KEY_FILE = /\.(pem|p12|pfx)$|^id_(rsa|ed25519)(\.|$)/;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.nuxt', '.output', '.turbo', 'coverage', 'target']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else out.push(relative(repoRoot, p).split(sep).join('/'));
  }
  return out;
}

/** Every path in the repo that is credential material. */
function credentialPaths(): string[] {
  return walk(repoRoot).filter((rel) => {
    const parts = rel.split('/');
    if (parts.some((seg) => SECRET_DIRS.has(seg))) return true;
    return KEY_FILE.test(parts[parts.length - 1]!);
  });
}

/**
 * Does `pattern` exclude `path`, under the subset of Docker's rules used here?
 * `*` does not cross `/`; a leading `**\/` matches any number of leading
 * directories; a trailing `/` means the directory and everything under it.
 */
function dockerMatches(pattern: string, path: string): boolean {
  let p = pattern.trim();
  if (!p || p.startsWith('#') || p.startsWith('!')) return false;

  let anyDepth = false;
  if (p.startsWith('**/')) { anyDepth = true; p = p.slice(3); }
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);

  const body = p.split('*').map((seg) => seg.replace(/[.+^${}()|[\]\\?]/g, '\\$&')).join('[^/]*');
  const prefix = anyDepth ? '(?:.*/)?' : '';
  // A matched directory excludes everything beneath it.
  const re = new RegExp(`^${prefix}${body}(?:/.*)?$`);
  return re.test(path);
}

const patterns = readFileSync(DOCKERIGNORE, 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

function isExcluded(path: string): boolean {
  return patterns.some((pat) => dockerMatches(pat, path));
}

describe('the matcher matches what Docker actually did', () => {
  // Verified by running `docker build` against a throwaway context carrying
  // this repo's real .dockerignore. These are observations, not assumptions.
  it('excludes what Docker excluded', () => {
    expect(dockerMatches('*.md', 'README.md')).toBe(true);
    expect(dockerMatches('docs/', 'docs/thing.md')).toBe(true);
    expect(dockerMatches('secrets/', 'secrets/CPUB_FED_TOKEN_KEYS.md')).toBe(true);
    expect(dockerMatches('.secrets/', '.secrets/cargo-registry-token')).toBe(true);
    expect(dockerMatches('**/secrets/', 'packages/x/secrets/nested-token')).toBe(true);
  });

  it('keeps what Docker kept — `*` does not cross a slash', () => {
    // The exact trap: `*.md` did NOT exclude the nested credential.
    expect(dockerMatches('*.md', 'secrets/CPUB_FED_TOKEN_KEYS.md')).toBe(false);
    expect(dockerMatches('.env*', '.secrets/cargo-registry-token')).toBe(false);
    expect(dockerMatches('*.md', 'index.js')).toBe(false);
    expect(dockerMatches('node_modules', 'package.json')).toBe(false);
  });
});

describe('.dockerignore keeps credentials out of the build context', () => {
  it('found the file and its rules', () => {
    expect(existsSync(DOCKERIGNORE)).toBe(true);
    expect(patterns.length).toBeGreaterThan(5);
  });

  const creds = credentialPaths();

  it('found the credentials it means to check', () => {
    expect(
      creds.length,
      `scanned the repo and found ${creds.length} credential paths`,
    ).toBeGreaterThanOrEqual(MIN_CREDENTIALS);
  });

  it('excludes every one of them', () => {
    const leaked = creds.filter((p) => !isExcluded(p));
    expect(
      leaked,
      `these would be COPIED into the image by \`COPY . .\`: ${leaked.join(', ')}`,
    ).toEqual([]);
  });

  it('still lets the build read what it needs', () => {
    for (const needed of ['package.json', 'pnpm-lock.yaml', 'turbo.json']) {
      expect(isExcluded(needed), `${needed} must reach the build`).toBe(false);
    }
  });
});
