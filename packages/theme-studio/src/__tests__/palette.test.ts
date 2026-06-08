import { describe, it, expect } from 'vitest';
import { buildPalette } from '../palette.js';
import { contrast, hexToHsl } from '../color.js';

describe('buildPalette', () => {
  it('dark mode keeps bg darker than surface than surface2', () => {
    const p = buildPalette({ accent: '#5b9cf6', scheme: 'analogous', mode: 'dark' });
    const l = (h: string): number => hexToHsl(h).l;
    expect(l(p.sem.bg)).toBeLessThan(l(p.sem.surface));
    expect(l(p.sem.surface)).toBeLessThan(l(p.sem.surface2));
  });

  it('light mode keeps text very dark on a near-white bg', () => {
    const p = buildPalette({ accent: '#5b9cf6', scheme: 'analogous', mode: 'light' });
    expect(hexToHsl(p.sem.text).l).toBeLessThan(20);
    expect(hexToHsl(p.sem.bg).l).toBeGreaterThan(90);
  });

  it('text on bg comfortably passes AA in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const p = buildPalette({ accent: '#c8643c', scheme: 'complementary', mode });
      expect(contrast(p.sem.text, p.sem.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('honors a hand-picked secondary over the harmony default', () => {
    const p = buildPalette({ accent: '#5b9cf6', secondary: '#ff00aa', scheme: 'analogous', mode: 'dark' });
    expect(p.sem.secondary).toBe('#ff00aa');
  });

  it('names every raw swatch uniquely', () => {
    const p = buildPalette({ accent: '#34d9a0', scheme: 'triadic', mode: 'dark' });
    const names = Object.values(p.names);
    expect(new Set(names).size).toBe(names.length);
  });
});
