import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join, relative } from 'node:path';

/**
 * Text on a coloured fill must use that fill's own on-colour token, and every
 * such pairing must clear WCAG AA (CLAUDE.md rule 12: AA is the minimum).
 *
 * `--color-text-inverse` means "text on an inverted surface" (a dark tooltip on
 * a light theme). It is not "text on a fill", and the two are identical in the
 * dark themes and opposite in the light ones, which is why the confusion
 * survives review.
 *
 * Session 253 swept one token for another by matching CLASS NAMES, so it
 * converted `.cpub-submit-btn` on forgot-password and missed the identical
 * `.submit-btn` on login and register: white on `#5b9cf6` is 2.79:1, below AA
 * and below even the 3:1 large-text floor, on the primary control of the
 * sign-in page.
 *
 * Session 254 then found the same defect on the other fills. `--green` was
 * 2.28:1 on base, worse than the accent case, and `--red` could not be fixed by
 * reusing `--color-on-accent` at all: on agora that scores 3.99:1 while
 * `--color-text-inverse` scores 4.51:1, so exactly one theme failed whichever
 * existing token was chosen. That is what forced a real per-fill token family
 * rather than another sweep.
 *
 * Matching on the declaration BLOCK is the fix for the original mistake: a
 * class-name scan can never be complete.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const SEARCH_DIRS = ['layers/base', 'packages/ui/src', 'packages/editor/vue', 'packages/explainer/vue'];
const EXT = /\.(vue|css)$/;

/** fill token -> the on-colour token that must accompany it. */
const FILL_PAIRS: Record<string, string> = {
  '--accent': '--color-on-accent',
  '--red': '--color-on-red',
  '--green': '--color-on-green',
};

const THEMES = ['base', 'dark', 'agora', 'agora-dark', 'stoa', 'stoa-dark'];

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
  fill: string;
  expected: string;
}

function findMismatchedFills(): Offender[] {
  const offenders: Offender[] = [];
  for (const file of SEARCH_DIRS.flatMap((d) => walk(resolve(repoRoot, d)))) {
    const src = readFileSync(file, 'utf8');
    BLOCK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BLOCK.exec(src)) !== null) {
      const [, selector, body] = m;
      if (!body) continue;
      const color = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body);
      const background = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(body);
      if (!color || !background) continue;
      // The closing paren is required. `var(--accent\\b` also matches
      // `var(--accent-bg)`, the TINT token, because the word boundary sits at the
      // hyphen. A tint is not a fill: its text should stay `--text`, and
      // "correcting" it to an on-colour would put white on a pale wash. This
      // regex cost a full false-positive sweep before it was caught.
      const fill = Object.keys(FILL_PAIRS).find((t) =>
        new RegExp(`var\\(\\s*${t}\\s*(?:,[^)]*)?\\)`).test(background[1]!),
      );
      if (!fill) continue;
      const expected = FILL_PAIRS[fill]!;
      // Anything token-based other than the matching on-colour is a mismatch.
      // A literal colour is left alone: CLAUDE.md rule 3 covers those separately.
      if (!color[1]!.includes('var(--')) continue;
      if (color[1]!.includes(expected)) continue;
      offenders.push({
        file: relative(repoRoot, file),
        line: src.slice(0, m.index).split('\n').length,
        selector: (selector ?? '').trim().split('\n').pop()!.trim(),
        fill,
        expected,
      });
    }
  }
  return offenders;
}

// --- WCAG maths, so the tokens are proved rather than asserted by name ---
const rgb = (hex: string): number[] => {
  const n = hex.replace('#', '');
  const f = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
const luminance = (c: number[]): number => {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
function themeToken(theme: string, name: string): string | null {
  const css = readFileSync(resolve(repoRoot, 'packages/ui/theme', `${theme}.css`), 'utf8');
  return new RegExp(`^\\s*${name}:\\s*(#[0-9a-fA-F]{3,8})`, 'm').exec(css)?.[1] ?? null;
}

describe('coloured fills use their own on-colour token', () => {
  it('finds no block pairing a fill with the wrong text token', () => {
    const offenders = findMismatchedFills();
    const detail = offenders
      .map((o) => `  ${o.file}:${o.line}  ${o.selector}  fills with var(${o.fill}) but does not use var(${o.expected})`)
      .join('\n');
    expect(offenders, offenders.length ? `\n${detail}\n` : '').toEqual([]);
  });

  it('every on-colour token clears AA against its fill, in every theme', () => {
    // The tokens are only worth having if the values are right. This is what
    // catches a palette change that quietly drops a pairing below 4.5:1.
    const failures: string[] = [];
    for (const theme of THEMES) {
      for (const [fill, onColour] of Object.entries(FILL_PAIRS)) {
        const bg = themeToken(theme, fill);
        const fg = themeToken(theme, onColour);
        if (!bg || !fg) {
          failures.push(`${theme}: ${fill}=${bg} ${onColour}=${fg} (token missing)`);
          continue;
        }
        const ratio = contrast(fg, bg);
        if (ratio < 4.5) failures.push(`${theme}: ${onColour} on ${fill} = ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('actually scans a meaningful number of files, so a green result means something', () => {
    // The guard on the guard. The first version of this test resolved the repo
    // root one level short, walked zero files, and reported a clean sweep.
    const files = SEARCH_DIRS.flatMap((d) => walk(resolve(repoRoot, d)));
    expect(files.length).toBeGreaterThan(100);
  });

  it('detects the pattern it is looking for', () => {
    // Positive control: proves the matcher works independently of the repo
    // being clean, so a broken regex cannot masquerade as a fixed codebase.
    const sample = `.x { background: var(--accent); color: var(--color-text-inverse); }`;
    BLOCK.lastIndex = 0;
    const m = BLOCK.exec(sample)!;
    const body = m[2]!;
    expect(/(?:^|;)\s*color\s*:\s*([^;]+)/.exec(body)![1]).toContain('--color-text-inverse');
    expect(/var\(\s*--accent\b/.test(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/.exec(body)![1]!)).toBe(true);
  });
});
