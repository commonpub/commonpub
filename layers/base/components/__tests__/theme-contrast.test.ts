import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { contrast } from '@commonpub/theme-studio';

// WCAG AA regression guard for two neutral-text rules that previously used
// --text-faint (failing: StatBar label 2.30:1 light, kbd keycap 2.10:1 light).
// Crucially this reads the token FROM the actual rule in source (not a hardcoded
// hex), maps it to its themed hex, and computes the real WCAG contrast — so a
// revert back to --text-faint (or a token regression) turns this red.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p: string): string => readFileSync(resolve(repoRoot, p), 'utf8');

/** token → hex for one theme file (:root light in base.css, dark block in dark.css). */
function tokenHexMap(css: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)) map[m[1]!] = m[2]!;
  return map;
}
const light = tokenHexMap(read('packages/ui/theme/base.css'));
const dark = tokenHexMap(read('packages/ui/theme/dark.css'));

/** the token referenced by a `color:`/`background:` in a named CSS rule. */
function ruleToken(css: string, selector: string, prop: 'color' | 'background'): string {
  const rule = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[\\s\\S]*?\\}`))?.[0];
  if (!rule) throw new Error(`rule ${selector} not found`);
  const tok = rule.match(new RegExp(`${prop}:\\s*var\\(--([a-z0-9-]+)\\)`))?.[1];
  if (!tok) throw new Error(`${prop} token not found in ${selector}`);
  return tok;
}

const AA = 4.5;

describe('theme contrast (WCAG AA) for neutral-text rules', () => {
  // StatBar label sits on --surface2 (its card backdrop).
  const statBarToken = ruleToken(read('packages/ui/theme/layouts.css'), '.cpub-stat-bar-label', 'color');
  it('StatBar label clears AA on --surface2 (light + dark)', () => {
    expect(contrast(light[statBarToken]!, light['surface2']!)).toBeGreaterThanOrEqual(AA);
    expect(contrast(dark[statBarToken]!, dark['surface2']!)).toBeGreaterThanOrEqual(AA);
  });

  // kbd keycap sits on the token named in its own `background:` (--surface3).
  const kbdCss = read('layers/base/layouts/default.vue');
  const kbdColor = ruleToken(kbdCss, '.cpub-kbd', 'color');
  const kbdBg = ruleToken(kbdCss, '.cpub-kbd', 'background');
  it('kbd keycap clears AA on its own background (light + dark)', () => {
    expect(contrast(light[kbdColor]!, light[kbdBg]!)).toBeGreaterThanOrEqual(AA);
    expect(contrast(dark[kbdColor]!, dark[kbdBg]!)).toBeGreaterThanOrEqual(AA);
  });

  // Documents WHY the fix was needed: the old --text-faint fails on both backdrops.
  it('the former --text-faint token fails AA on both backdrops (light)', () => {
    expect(contrast(light['text-faint']!, light['surface2']!)).toBeLessThan(AA);
    expect(contrast(light['text-faint']!, light['surface3']!)).toBeLessThan(AA);
  });
});
