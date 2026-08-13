/**
 * WCAG AA contrast regression guard for the persona theme block.
 *
 * MEASURE WHAT YOU SHIP. This reads the token NAMED IN THE RULE out of
 * `packages/ui/theme/components.css`, resolves it to a real hex per theme, and
 * scores it. It does not score an intended colour: a scorer that measured
 * `#000000` while the code emitted `#0a0a0a` passed its own AA check and shipped
 * 4.40:1 once already.
 *
 * It caught a real one on the way in. `.cpub-chip-help` and
 * `.cpub-persona-field-help` were originally `--text-faint`, which is 2.53:1 on
 * `--surface` in the light theme, an outright AA failure on the text that
 * explains what a persona question means. Both are `--text-dim` now.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { contrast } from '@commonpub/theme-studio';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (p: string): string => readFileSync(resolve(repoRoot, p), 'utf8');

/** token -> hex, for the `:root`-level declarations of one theme file. */
function tokenHexMap(css: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)) map[m[1]!] = m[2]!;
  return map;
}

/** Every shipped theme, each layered over the light base it overrides. */
const BASE = tokenHexMap(read('packages/ui/theme/base.css'));
const THEMES: Array<[string, Record<string, string>]> = [
  ['light', BASE],
  ['dark', { ...BASE, ...tokenHexMap(read('packages/ui/theme/dark.css')) }],
  ['agora', { ...BASE, ...tokenHexMap(read('packages/ui/theme/agora.css')) }],
  ['agora-dark', { ...BASE, ...tokenHexMap(read('packages/ui/theme/agora-dark.css')) }],
  ['stoa', { ...BASE, ...tokenHexMap(read('packages/ui/theme/stoa.css')) }],
  ['stoa-dark', { ...BASE, ...tokenHexMap(read('packages/ui/theme/stoa-dark.css')) }],
];

const components = read('packages/ui/theme/components.css');
const personaStart = components.indexOf('PERSONA (session 255)');
const personaBlock = personaStart === -1 ? '' : components.slice(personaStart);

/** The token a named rule in the persona block sets for `prop`. */
function ruleToken(selector: string, prop: 'color' | 'background'): string {
  const rule = personaBlock.match(
    new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{[\\s\\S]*?\\}`),
  )?.[0];
  if (!rule) throw new Error(`persona rule ${selector} not found`);
  const tok = rule.match(new RegExp(`${prop}:\\s*var\\(--([a-z0-9-]+)\\)`))?.[1];
  if (!tok) throw new Error(`${prop} token not found in ${selector}`);
  return tok;
}

const AA = 4.5;

/**
 * The surface each rule's text actually sits on. `--surface` for anything inside
 * a section body, `--surface2` for the section header, and `--yellow-bg` /
 * `--accent-bg` are low-alpha overlays over `--surface`, so `--surface` is the
 * honest backdrop to score them against.
 */
const CASES: Array<[string, string, string]> = [
  ['.cpub-chip-help', 'color', 'surface'],
  ['.cpub-chip-legend', 'color', 'surface'],
  ['.cpub-chip-status', 'color', 'surface'],
  ['.cpub-persona-field-help', 'color', 'surface'],
  ['.cpub-persona-field-label', 'color', 'surface'],
  ['.cpub-persona-section-help', 'color', 'surface'],
  ['.cpub-persona-section-count', 'color', 'surface2'],
  ['.cpub-persona-meter-text', 'color', 'surface'],
  ['.cpub-persona-meter-note', 'color', 'surface'],
  ['.cpub-persona-retired-intro', 'color', 'surface'],
  ['.cpub-persona-retired-key', 'color', 'surface'],
  ['.cpub-persona-retired-meta', 'color', 'surface'],
  ['.cpub-persona-invite-text', 'color', 'surface'],
];

describe('persona theme contrast (WCAG AA)', () => {
  it('found the persona block and every rule it is about to score', () => {
    // P7: without this, a renamed block would make every case below throw
    // nothing and score nothing.
    expect(personaStart).toBeGreaterThan(0);
    expect(CASES.length).toBeGreaterThanOrEqual(13);
    for (const [selector, prop] of CASES) {
      expect(ruleToken(selector, prop as 'color'), selector).toMatch(/^[a-z0-9-]+$/);
    }
    expect(THEMES.length).toBe(6);
  });

  it.each(CASES)('%s clears AA in every theme', (selector, prop, bgToken) => {
    const fgToken = ruleToken(selector, prop as 'color' | 'background');
    for (const [theme, tokens] of THEMES) {
      const fg = tokens[fgToken];
      const bg = tokens[bgToken];
      expect(fg, `${theme}: --${fgToken} has no hex`).toBeTruthy();
      expect(bg, `${theme}: --${bgToken} has no hex`).toBeTruthy();
      const ratio = contrast(fg!, bg!);
      expect(
        ratio,
        `${theme}: ${selector} uses --${fgToken} on --${bgToken} at ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA);
    }
  });

  it('detects the failure it was written to catch', () => {
    // The positive control. --text-faint on --surface is the pair that was
    // originally shipped on the help text; if this ever starts passing, the
    // measurement is broken, not the palette.
    expect(contrast(BASE['text-faint']!, BASE['surface']!)).toBeLessThan(AA);
  });
});
