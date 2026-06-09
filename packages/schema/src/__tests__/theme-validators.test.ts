/**
 * Custom-theme validator coverage (advanced-tokens plan).
 *
 * The load-bearing piece is the `bg-image` value guard: background-image is
 * the one token whose value can FETCH (url() = beacon/exfil channel), so the
 * schema only admits `none` or CSS gradients. Known-bad payloads are tested
 * red per [[feedback_regex_empty_alternation]] — never trust an allowlist
 * regex without adversarial inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  customThemeSchema,
  themeRecipeSchema,
  themeTokenMapSchema,
  isSafeBgImageValue,
} from '../validators.js';

const baseTheme = {
  id: 'cpub-custom-test',
  name: 'Test',
  family: 'test',
  isDark: false,
  parentTheme: 'base',
};

describe('themeTokenMapSchema bg-image guard', () => {
  const GOOD = [
    'none',
    'linear-gradient(165deg, #10131a 0%, #131825 100%)',
    'linear-gradient(165deg, rgba(16,19,26,1), rgba(19,24,37,1))',
    'radial-gradient(circle at 30% 0%, #fff, #fafaf9)',
    'repeating-linear-gradient(45deg, #eee 0 2px, #fff 2px 10px)',
    'conic-gradient(from 90deg, #111, #222)',
  ];
  const BAD = [
    'url(https://evil.example/p.gif)',
    'url(//evil.example/p.gif)', // protocol-relative, no colon needed
    'linear-gradient(red, blue) url(//evil.example/x)',
    'image-set("https://evil.example/x.png" 1x)',
    'linear-gradient(red, blue), url(x.png)',
    '\\75rl(https://evil.example)', // CSS-escaped "url("
    'linear-gradient(red, \\75rl(x))',
    'image("https://evil.example/x.png")',
    'cross-fade(url(x.png) 50%, red)',
    'paint(something) url(x)',
    '', // empty is not a valid token value anyway
  ];

  it('accepts none + gradients', () => {
    for (const v of GOOD) {
      expect(isSafeBgImageValue(v), `should accept: ${v}`).toBe(true);
      expect(
        themeTokenMapSchema.safeParse({ 'bg-image': v }).success,
        `map should accept: ${v}`,
      ).toBe(true);
    }
  });

  it('rejects every known-bad fetch/smuggle payload', () => {
    for (const v of BAD) {
      expect(isSafeBgImageValue(v), `should reject: ${v}`).toBe(false);
      expect(
        themeTokenMapSchema.safeParse({ 'bg-image': v }).success,
        `map should reject: ${v}`,
      ).toBe(false);
    }
  });

  it('does not constrain other token values', () => {
    const r = themeTokenMapSchema.safeParse({
      accent: '#5b9cf6',
      'surface-backdrop': 'blur(12px) saturate(1.35)',
      'cpub-topbar-bg': 'rgba(255,255,255,0.85)',
    });
    expect(r.success).toBe(true);
  });

  it('the guard reaches customThemeSchema.tokens (the API parse path)', () => {
    const bad = customThemeSchema.safeParse({
      ...baseTheme,
      tokens: { 'bg-image': 'url(https://evil.example/x)' },
    });
    expect(bad.success).toBe(false);
    const good = customThemeSchema.safeParse({
      ...baseTheme,
      tokens: { 'bg-image': 'linear-gradient(165deg, #111, #222)' },
    });
    expect(good.success).toBe(true);
  });
});

describe('themeRecipeSchema treatment field', () => {
  const baseRecipe = {
    mode: 'dark',
    accent: '#5b9cf6',
    scheme: 'analogous',
    fonts: { display: 'Sora', body: 'Inter', ui: 'IBM Plex Mono', code: 'JetBrains Mono' },
    baseSize: 16,
    ratio: 1.25,
    spaceBase: 4,
    density: 'balanced',
    shapeRadius: 6,
    borderWidth: 2,
    shadowStyle: 'soft',
    motion: 'snappy',
  };

  it('treatment is optional (legacy recipes still parse)', () => {
    expect(themeRecipeSchema.safeParse(baseRecipe).success).toBe(true);
  });

  it('accepts a bounded glass + bgGradient treatment', () => {
    const r = themeRecipeSchema.safeParse({
      ...baseRecipe,
      treatment: { glass: 0.12, bgGradient: true },
    });
    expect(r.success).toBe(true);
  });

  it('rejects out-of-range glass strength', () => {
    expect(
      themeRecipeSchema.safeParse({ ...baseRecipe, treatment: { glass: 0.9 } }).success,
    ).toBe(false);
    expect(
      themeRecipeSchema.safeParse({ ...baseRecipe, treatment: { glass: -0.1 } }).success,
    ).toBe(false);
  });
});
