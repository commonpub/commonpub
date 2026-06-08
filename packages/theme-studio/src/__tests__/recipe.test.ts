import { describe, it, expect } from 'vitest';
import { randomizeRecipe, defaultRecipe, randomName, isKnownFont } from '../recipe.js';
import { ALL_FONTS } from '../fonts.js';
import { HARMONY_SCHEMES } from '../harmony.js';

describe('randomizeRecipe', () => {
  it('is deterministic for a fixed seed', () => {
    expect(randomizeRecipe(42)).toEqual(randomizeRecipe(42));
  });

  it('varies across seeds', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 25; i++) seen.add(JSON.stringify(randomizeRecipe(i)));
    // Plenty of distinct recipes from 25 seeds (not all collapsing to one).
    expect(seen.size).toBeGreaterThan(10);
  });

  it('always yields a structurally valid recipe drawn from the catalog', () => {
    for (let i = 0; i < 50; i++) {
      const r = randomizeRecipe(i);
      expect(['light', 'dark']).toContain(r.mode);
      expect(HARMONY_SCHEMES).toContain(r.scheme);
      expect([4, 8]).toContain(r.spaceBase);
      expect(isKnownFont(r.fonts.display)).toBe(true);
      expect(isKnownFont(r.fonts.body)).toBe(true);
      expect(r.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(r.shapeRadius).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('helpers', () => {
  it('defaultRecipe is on-brand and valid', () => {
    const r = defaultRecipe();
    expect(r.accent).toBe('#5b9cf6');
    expect(ALL_FONTS).toContain(r.fonts.display);
  });

  it('randomName is deterministic + uppercase', () => {
    expect(randomName(7)).toBe(randomName(7));
    expect(randomName(7)).toMatch(/^[A-Z]+$/);
  });
});
