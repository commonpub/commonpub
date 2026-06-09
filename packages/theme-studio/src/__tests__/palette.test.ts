import { describe, it, expect } from 'vitest';
import { buildPalette, suggestPalettes } from '../palette.js';
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

describe('buildPalette — independent neutrals (Phase 2)', () => {
  it('neutralHue pins the surface hue regardless of accent', () => {
    const opts = { scheme: 'analogous', mode: 'dark', neutralHue: 30, neutralSat: 12 } as const;
    const blue = buildPalette({ accent: '#2f6fed', ...opts });
    const pink = buildPalette({ accent: '#ff3d8b', ...opts });
    // Same neutralHue → same bg hue even though the accents are far apart.
    expect(Math.abs(hexToHsl(blue.sem.bg).h - hexToHsl(pink.sem.bg).h)).toBeLessThan(3);
  });

  it('neutralSat 0 produces a pure-gray surface (no hue tint)', () => {
    const p = buildPalette({ accent: '#5b9cf6', scheme: 'analogous', mode: 'light', neutralHue: 0, neutralSat: 0 });
    expect(hexToHsl(p.sem.surface).s).toBeLessThan(2);
  });

  it('overriding the neutral hue moves the surfaces off the accent', () => {
    const accent = '#5b9cf6'; // hue ~215
    const tied = buildPalette({ accent, scheme: 'analogous', mode: 'dark', neutralSat: 12 });
    const decoupled = buildPalette({ accent, scheme: 'analogous', mode: 'dark', neutralHue: 120, neutralSat: 12 });
    expect(Math.abs(hexToHsl(tied.sem.bg).h - hexToHsl(decoupled.sem.bg).h)).toBeGreaterThan(40);
  });
});

describe('suggestPalettes (Phase 4)', () => {
  it('returns several applicable, distinct options each with a 5-swatch preview', () => {
    const opts = suggestPalettes('#5b9cf6', 'dark');
    expect(opts.length).toBeGreaterThanOrEqual(4);
    for (const o of opts) expect(o.preview).toHaveLength(5);
    // Warm vs Cool produce visibly different backgrounds.
    const warm = opts.find((o) => o.k === 'warm')!;
    const cool = opts.find((o) => o.k === 'cool')!;
    expect(warm.preview[0]).not.toBe(cool.preview[0]);
    // Vivid carries a secondary; Mono is pure-neutral.
    expect(opts.find((o) => o.k === 'vivid')!.secondary).toBeTruthy();
    expect(opts.find((o) => o.k === 'mono')!.neutralSat).toBe(0);
  });
});
