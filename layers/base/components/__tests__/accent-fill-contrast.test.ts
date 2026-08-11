import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join, relative } from 'node:path';

/**
 * No accent-filled element may take its text colour from --color-text-inverse.
 *
 * The two tokens mean different things. `--color-text-inverse` is "text on an
 * inverted surface" (a dark tooltip on a light theme); `--color-on-accent` is
 * "text on the accent fill". They happen to be identical in the dark themes,
 * which is why the difference goes unnoticed there, and they are opposites in
 * the light ones.
 *
 * Session 253 swept one for the other by matching CLASS NAMES, so it converted
 * `.cpub-submit-btn` on forgot-password and missed the identical `.submit-btn`
 * on login and register. Measured on the shipped default theme, white on
 * `#5b9cf6` is 2.79:1: below AA 4.5:1 and below even the 3:1 large-text floor,
 * on the primary control of the sign-in page, while `.cpub-btn-primary` beside
 * it rendered 6.24:1. Three of seven themes failed (base 2.79, agora 3.78,
 * stoa 4.44).
 *
 * The existing contrast tests assert token PAIRS and structurally cannot see a
 * component usage, which is why this scans declaration blocks instead. Matching
 * on the block is also the fix for the original mistake: a class-name scan can
 * never be complete.
 *
 * `--red` is deliberately NOT covered. On agora, `--color-on-accent` scores
 * 3.99:1 against `--red` versus 4.51:1 for `--color-text-inverse`, so the same
 * swap there REGRESSES contrast. Exactly one theme fails either way, so red
 * needs its own `--color-on-red` token rather than a blanket rule.
 */
// __tests__ -> components -> base -> layers -> repo root. Getting this wrong
// makes the scan walk nothing and report a clean sweep, which is what the
// file-count assertion below exists to catch. It caught it once already.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const SEARCH_DIRS = [
  'layers/base',
  'packages/ui/src',
  'packages/editor/vue',
  'packages/explainer/vue',
];
const EXT = /\.(vue|css)$/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e === '.nuxt') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(e)) out.push(p);
  }
  return out;
}

/** A leaf CSS declaration block: selector plus the declarations inside `{ }`. */
const BLOCK = /([^{}]+)\{([^{}]*)\}/g;

interface Offender {
  file: string;
  line: number;
  selector: string;
}

function findAccentFillsUsingInverse(): Offender[] {
  const offenders: Offender[] = [];
  for (const file of SEARCH_DIRS.flatMap((d) => walk(resolve(repoRoot, d)))) {
    const src = readFileSync(file, 'utf8');
    BLOCK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BLOCK.exec(src)) !== null) {
      const [, selector, body] = m;
      if (!body || !body.includes('--color-text-inverse')) continue;
      const color = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body);
      if (!color || !color[1].includes('--color-text-inverse')) continue;
      const background = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(body);
      if (!background || !/var\(\s*--accent\b/.test(background[1]!)) continue;
      offenders.push({
        file: relative(repoRoot, file),
        line: src.slice(0, m.index).split('\n').length,
        selector: (selector ?? '').trim().split('\n').pop()!.trim(),
      });
    }
  }
  return offenders;
}

describe('accent-filled elements use the on-accent token', () => {
  it('finds no block that fills with --accent and colours with --color-text-inverse', () => {
    const offenders = findAccentFillsUsingInverse();
    const detail = offenders.map((o) => `  ${o.file}:${o.line}  ${o.selector}`).join('\n');
    expect(
      offenders,
      offenders.length
        ? `These blocks paint text on an accent fill using --color-text-inverse, which is 2.79:1 on the default theme:\n${detail}\n\nUse var(--color-on-accent).`
        : '',
    ).toEqual([]);
  });

  it('actually scans a meaningful number of files, so a green result means something', () => {
    // A scanner that silently walks nothing passes forever. This is the guard on
    // the guard: if the directory list or the extension filter breaks, this
    // fails rather than reporting a clean sweep of zero files.
    const files = SEARCH_DIRS.flatMap((d) => walk(resolve(repoRoot, d)));
    expect(files.length).toBeGreaterThan(100);
  });

  it('detects the pattern it is looking for', () => {
    // Proves the matcher works, independently of the repo being clean. Without
    // this, a broken regex and a fixed codebase are indistinguishable.
    const sample = `.x { background: var(--accent); color: var(--color-text-inverse); }`;
    BLOCK.lastIndex = 0;
    const m = BLOCK.exec(sample)!;
    const body = m[2]!;
    const color = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body)!;
    const background = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(body)!;
    expect(color[1]).toContain('--color-text-inverse');
    expect(/var\(\s*--accent\b/.test(background[1]!)).toBe(true);
  });
});
