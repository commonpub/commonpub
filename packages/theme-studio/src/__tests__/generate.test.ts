import { describe, it, expect } from 'vitest';
import { recipeToTokens } from '../generate.js';
import { defaultRecipe, randomizeRecipe, type ThemeRecipe } from '../recipe.js';
import { COLOR_VIBES } from '../presets.js';
import { contrast } from '../color.js';
// Import the canonical token contract straight from @commonpub/ui's pure
// source (tokens.ts imports nothing — no Vue is loaded). This keeps the
// projection honest against the real registry without a runtime dep.
import { validateTokenOverrides } from '../../../ui/src/tokens.js';

// The server enforces a per-value length cap (validators.ts:
// themeTokenValueSchema = string 1..512). Re-declared here as a constant.
const VALUE_MAX = 512;

function recipeFromPal(accent: string, mode: 'light' | 'dark', scheme: ThemeRecipe['scheme']): ThemeRecipe {
  return { ...defaultRecipe(), accent, mode, scheme };
}

describe('recipeToTokens', () => {
  it('emits only canonical token keys (no unknowns)', () => {
    const { tokens } = recipeToTokens(defaultRecipe());
    const { invalid } = validateTokenOverrides(tokens);
    expect(invalid).toEqual([]);
  });

  it('every random recipe also emits only canonical keys', () => {
    for (let i = 0; i < 30; i++) {
      const { tokens } = recipeToTokens(randomizeRecipe(i));
      expect(validateTokenOverrides(tokens).invalid).toEqual([]);
    }
  });

  it('all token values are within the server length cap', () => {
    const { tokens } = recipeToTokens(randomizeRecipe(3));
    for (const v of Object.values(tokens)) {
      expect(v.length).toBeGreaterThan(0);
      expect(v.length).toBeLessThanOrEqual(VALUE_MAX);
    }
  });

  it('picks a mode-matched parent theme', () => {
    expect(recipeToTokens({ ...defaultRecipe(), mode: 'dark' }).parentTheme).toBe('dark');
    expect(recipeToTokens({ ...defaultRecipe(), mode: 'light' }).parentTheme).toBe('base');
  });

  it('produces an AA-passing text/bg pair for every curated preset', () => {
    for (const vibe of COLOR_VIBES) {
      for (const p of vibe.pals) {
        const { tokens } = recipeToTokens(recipeFromPal(p.a, p.mode, p.s));
        const ratio = contrast(tokens['text']!, tokens['bg']!);
        expect(ratio, `${vibe.name}/${p.n}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('text/bg AND on-accent button text clear AA for ARBITRARY accents (not just presets)', () => {
    // Sweep the hue wheel at varied lightness/sat so we catch a mid-tone
    // accent that a preset list would never include.
    const accents = ['#000000', '#ffffff', '#808080', '#7f7f00', '#00807f', '#3b82f6', '#facc15', '#16a34a', '#db2777', '#9333ea'];
    for (const a of accents) {
      for (const mode of ['light', 'dark'] as const) {
        const { tokens } = recipeToTokens(recipeFromPal(a, mode, 'analogous'));
        expect(contrast(tokens['text']!, tokens['bg']!), `text/bg ${a}/${mode}`).toBeGreaterThanOrEqual(4.5);
        // Button label legibility: on-accent is the better of black/white,
        // which is provably >= ~4.58 against any accent.
        expect(contrast(tokens['color-on-accent']!, tokens['accent']!), `on-accent ${a}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('emits a strictly-increasing type ramp (no inversion between md and the rest)', () => {
    const { tokens } = recipeToTokens({ ...defaultRecipe(), baseSize: 16, ratio: 1.2 });
    const order = ['text-xs', 'text-sm', 'text-base', 'text-md', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'];
    const px = order.map((k) => parseFloat(tokens[k]!) * 16); // rem → px
    for (let i = 1; i < px.length; i++) expect(px[i]).toBeGreaterThan(px[i - 1]!);
  });

  it('does NOT emit radius-full (avatars must stay circular via the parent default)', () => {
    const { tokens } = recipeToTokens({ ...defaultRecipe(), shapeRadius: 20 });
    expect(tokens['radius-full']).toBeUndefined();
    expect(tokens['radius']).toBe('20px');
  });

  it('maps fonts to families + a googleapis href', () => {
    const r: ThemeRecipe = {
      ...defaultRecipe(),
      fonts: { display: 'Playfair Display', body: 'Inter', ui: 'Space Mono', code: 'JetBrains Mono' },
    };
    const g = recipeToTokens(r);
    expect(g.tokens['font-display']).toContain('Playfair Display');
    expect(g.tokens['font-mono']).toContain('JetBrains Mono');
    expect(g.fonts).toContain('Playfair Display');
    expect(g.fontHref).toContain('https://fonts.googleapis.com/css2?');
    expect(g.fontHref).toContain('Playfair+Display');
  });

  it('honors base size + ratio in the type ramp', () => {
    const g = recipeToTokens({ ...defaultRecipe(), baseSize: 16, ratio: 1.25 });
    expect(g.tokens['text-base']).toBe('1rem');
    // lg = 16 * 1.25 = 20px = 1.25rem
    expect(g.tokens['text-lg']).toBe('1.25rem');
  });

  it('honors spacing base (airy grid doubles the ramp)', () => {
    const tight = recipeToTokens({ ...defaultRecipe(), spaceBase: 4 });
    const airy = recipeToTokens({ ...defaultRecipe(), spaceBase: 8 });
    expect(tight.tokens['space-4']).toBe('1rem'); // 4*4=16px
    expect(airy.tokens['space-4']).toBe('2rem'); // 4*8=32px
  });
});
