/**
 * Guards the theme radius model (session 193).
 *
 * The old `*, *::before, *::after { border-radius: var(--radius) }` rounded
 * EVERY element on a non-zero-radius theme (Stoa = 12px) — including line
 * breaks, dividers, icons, images, table cells, and pseudo decorations
 * ("rounded line breaks" bug). The fix keeps `* { border-radius }` for real
 * surfaces but resets structural/media/pseudo elements to 0.
 *
 * These string assertions are intentionally coarse — they only fail if the
 * model is accidentally reverted (radius put back on the box-sizing reset, or
 * the structural reset removed).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// vitest stubs `*.css?raw` imports to empty, and import.meta.url isn't a file://
// URL here, so walk up from cwd to find the source CSS (works whether the suite
// runs from packages/ui or the repo root).
function readBaseCss(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ['theme/base.css', 'packages/ui/theme/base.css']) {
      const p = resolve(dir, rel);
      if (existsSync(p)) return readFileSync(p, 'utf8');
    }
    dir = dirname(dir);
  }
  throw new Error(`base.css not found from ${process.cwd()}`);
}
const baseCss = readBaseCss();

describe('theme radius model (base.css)', () => {
  it('the box-sizing reset no longer carries border-radius', () => {
    // Isolate the `*, *::before, *::after { ... }` rule and assert it only sets box-sizing.
    const m = baseCss.match(/\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}/);
    expect(m, 'box-sizing universal rule should exist').toBeTruthy();
    expect(m![1]).toContain('box-sizing');
    expect(m![1]).not.toContain('border-radius');
  });

  it('surfaces still inherit the theme radius via `* { border-radius }`', () => {
    expect(baseCss).toMatch(/\*\s*\{\s*border-radius:\s*var\(--radius\);?\s*\}/);
  });

  it('structural / media / pseudo elements are reset to border-radius: 0', () => {
    // The reset block lists hr + media + pseudo + .cpub-divider and zeroes radius.
    const reset = baseCss.match(/hr,[\s\S]*?\.cpub-divider\s*\{\s*border-radius:\s*0;?\s*\}/);
    expect(reset, 'structural radius reset block should exist').toBeTruthy();
    for (const sel of ['hr', 'svg', 'img', '::before', '::after']) {
      expect(reset![0]).toContain(sel);
    }
  });
});
