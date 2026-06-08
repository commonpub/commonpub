import { describe, it, expect } from 'vitest';
import {
  typeScale,
  spaceScale,
  radiusScale,
  buildShadows,
  motionTokens,
  TYPE_STEPS,
  type TypeStep,
} from '../scales.js';
import { buildPalette } from '../palette.js';

describe('typeScale', () => {
  it('is strictly increasing across every step', () => {
    const ts = typeScale(16, 1.25);
    const order: TypeStep[] = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];
    for (let i = 1; i < order.length; i++) {
      expect(ts[order[i]!]).toBeGreaterThan(ts[order[i - 1]!]);
    }
  });

  it('pins base to the chosen size and floors at 10px', () => {
    expect(typeScale(16, 1.25).base).toBe(16);
    expect(typeScale(13, 1.2).base).toBe(13);
    // xs at a small base + ratio never drops below 10.
    for (const k of Object.keys(TYPE_STEPS) as TypeStep[]) {
      expect(typeScale(13, 1.618)[k]).toBeGreaterThanOrEqual(10);
    }
  });

  it('a bigger ratio produces a bigger top end', () => {
    expect(typeScale(16, 1.618)['6xl']).toBeGreaterThan(typeScale(16, 1.2)['6xl']);
  });
});

describe('spaceScale', () => {
  it('is strictly increasing', () => {
    const ss = spaceScale(4);
    const vals = Object.values(ss);
    for (let i = 1; i < vals.length; i++) expect(vals[i]!).toBeGreaterThan(vals[i - 1]!);
  });

  it('airy base (8) is uniformly larger than tight base (4)', () => {
    const tight = spaceScale(4);
    const airy = spaceScale(8);
    for (const k of Object.keys(tight) as (keyof typeof tight)[]) {
      expect(airy[k]).toBeGreaterThan(tight[k]);
    }
  });
});

describe('radiusScale', () => {
  it('sharp (0) collapses the whole ramp to 0 (except full)', () => {
    const r = radiusScale(0);
    expect([r.sm, r.md, r.lg, r.xl, r['2xl']]).toEqual([0, 0, 0, 0, 0]);
    expect(r.full).toBe(9999);
  });

  it('non-zero base keeps sm <= md <= lg <= xl <= 2xl', () => {
    const r = radiusScale(12);
    expect(r.sm).toBeLessThanOrEqual(r.md);
    expect(r.md).toBeLessThanOrEqual(r.lg);
    expect(r.lg).toBeLessThanOrEqual(r.xl);
    expect(r.xl).toBeLessThanOrEqual(r['2xl']);
  });
});

describe('buildShadows', () => {
  const sem = buildPalette({ accent: '#5b9cf6', scheme: 'analogous', mode: 'dark' }).sem;

  it('none → every level is "none"', () => {
    const sh = buildShadows('none', 2, 'dark', sem);
    expect([sh.sm, sh.md, sh.lg, sh.xl]).toEqual(['none', 'none', 'none', 'none']);
  });

  it('hard → offset block shadows using the text color (no blur)', () => {
    const sh = buildShadows('hard', 2, 'light', buildPalette({ accent: '#5b9cf6', scheme: 'analogous', mode: 'light' }).sem);
    expect(sh.md).toMatch(/^\d+px \d+px 0 /);
    expect(sh.md).not.toContain('rgba(0,0,0,'); // not the soft tint
  });

  it('glow rings the accent', () => {
    const sh = buildShadows('glow', 2, 'dark', sem);
    expect(sh.md.toLowerCase()).toContain('rgba');
  });
});

describe('motionTokens', () => {
  it('sharp is fastest, smooth is slowest', () => {
    const sharp = parseInt(motionTokens('sharp').dur, 10);
    const snappy = parseInt(motionTokens('snappy').dur, 10);
    const smooth = parseInt(motionTokens('smooth').dur, 10);
    expect(sharp).toBeLessThan(snappy);
    expect(snappy).toBeLessThan(smooth);
  });
});
