/**
 * WCAG contrast regression for the SHIPPED theme CSS in `packages/ui/theme`.
 *
 * Why this lives here and not in `packages/ui`: theme-studio already owns the
 * contrast math (`contrast()` / `wcag()` in ../color). Re-deriving luminance in
 * a second package is how mirrored copies drift apart, so the test comes to the
 * math rather than the math being copied to the test.
 *
 * What it locks: the filled call-to-action pair. `.cpub-btn-primary` renders
 * `--color-on-accent` on `--accent` (packages/ui/theme/layouts.css), and until
 * session 253 that was `#ffffff` on `#5b9cf6` = 2.79:1 in the two classic
 * themes — below even the 3:1 large-text floor, shipped to every instance that
 * had not overridden it. Nothing caught it because no test read these two
 * tokens together. Now one does.
 *
 * Scope note: this asserts the TOKEN PAIR, not every rendered button. A
 * component that hardcodes `var(--color-text-inverse)` on an accent fill in its
 * own scoped CSS is a separate (still open) class of the same bug.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { contrast } from '../color';

/** Same cwd-walk the ui package's own token tests use. */
function themeDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ['packages/ui/theme', '../ui/theme', 'theme']) {
      const p = resolve(dir, rel);
      if (existsSync(resolve(p, 'base.css'))) return p;
    }
    dir = dirname(dir);
  }
  throw new Error(`packages/ui/theme not found from ${process.cwd()}`);
}

function readTheme(id: string): string {
  return readFileSync(resolve(themeDir(), `${id}.css`), 'utf8');
}

/**
 * Last declaration of `--name` in a stylesheet. Themes declare their tokens in
 * a single `:root`/`[data-theme]` block, and a later declaration is the one the
 * cascade resolves, so "last wins" matches what the browser does.
 */
function token(css: string, name: string): string | null {
  const matches = [...css.matchAll(new RegExp(`--${name}\\s*:\\s*([^;}]+)`, 'g'))];
  return matches.length ? matches[matches.length - 1][1].trim() : null;
}

/**
 * A token's effective value for a theme: its own declaration, else base.css's
 * (non-base themes inherit what they do not redeclare), following `var(--x)`
 * indirection — `--color-primary: var(--accent)` is the common case.
 */
function resolveToken(id: string, name: string): string {
  let current: string | null = token(readTheme(id), name) ?? token(readTheme('base'), name);
  for (let hops = 0; current && hops < 4; hops++) {
    const ref = /^var\(\s*--([\w-]+)/.exec(current);
    if (!ref) return current;
    current = token(readTheme(id), ref[1]) ?? token(readTheme('base'), ref[1]);
  }
  if (!current) throw new Error(`--${name} is defined in neither ${id}.css nor base.css`);
  return current;
}

// The shipped theme stylesheets, as a literal rather than a glob so a new theme
// file fails this test until someone checks its contrast on purpose.
const THEMES = ['base', 'dark', 'generics', 'agora', 'agora-dark', 'stoa', 'stoa-dark'];

// Every token that names "the label colour on a filled accent/primary surface",
// paired with the fill it sits on. All four must agree per theme, or a theme
// author picking one of the aliases silently gets the failing value — which is
// exactly how generics.css ended up with a dark --color-accent-text and a white
// --color-on-accent at the same time.
const PAIRS: Array<[fg: string, bg: string]> = [
  ['color-on-accent', 'accent'],
  ['color-accent-text', 'accent'],
  ['color-on-primary', 'color-primary'],
  ['color-primary-text', 'color-primary'],
];

describe('shipped theme CSS: filled CTA contrast', () => {
  for (const [fgName, bgName] of PAIRS) {
    it.each(THEMES)(`%s: --${fgName} on --${bgName} clears WCAG AA (4.5:1)`, (id) => {
      const bg = resolveToken(id, bgName);
      const fg = resolveToken(id, fgName);
      const ratio = contrast(fg, bg);
      expect(
        ratio,
        `${id}.css: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }

  it.each(THEMES)('%s: the four on-accent aliases agree', (id) => {
    const values = PAIRS.map(([fg]) => resolveToken(id, fg));
    expect(new Set(values).size, `${id}.css declares ${values.join(', ')}`).toBe(1);
  });
});
