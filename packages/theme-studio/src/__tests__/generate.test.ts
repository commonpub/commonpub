import { describe, it, expect } from 'vitest';
import { recipeToTokens, recipeToThemePair } from '../generate.js';
import { hexToHsl, rgbToHex, blendOver, mixHex } from '../color.js';
import { defaultRecipe, randomizeRecipe, type ThemeRecipe } from '../recipe.js';
import { COLOR_VIBES, DESIGN_ARCHETYPES } from '../presets.js';
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

  it('keeps the accent visible AND links AA-readable on the bg for any accent (per mode)', () => {
    // Includes pale/extreme accents that read badly on the wrong mode.
    const accents = ['#34d9a0', '#facc15', '#5b9cf6', '#a7f3d0', '#1e1b4b', '#ffffff', '#000000', '#ec4899'];
    for (const a of accents) {
      for (const mode of ['light', 'dark'] as const) {
        const { tokens } = recipeToTokens(recipeFromPal(a, mode, 'analogous'));
        // Accent stays distinguishable from the page (UI-component threshold ~2.4).
        expect(contrast(tokens['accent']!, tokens['bg']!), `accent vis ${a}/${mode}`).toBeGreaterThanOrEqual(2.3);
        // Links clear AA as text on the bg.
        expect(contrast(tokens['color-link']!, tokens['bg']!), `link AA ${a}/${mode}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens['color-link-hover']!, tokens['bg']!), `link-hover AA ${a}/${mode}`).toBeGreaterThanOrEqual(4.5);
        // The readable accent preserves the chosen hue (it only shifts lightness).
        expect(Math.abs(hexToHsl(tokens['accent']!).h - hexToHsl(a).h), `hue kept ${a}`).toBeLessThan(8);
      }
    }
  });

  it('emits a secondary accent (readable on bg) + on-secondary text', () => {
    for (const mode of ['light', 'dark'] as const) {
      const { tokens } = recipeToTokens({ ...defaultRecipe(), mode, secondary: '#8b5cf6' });
      expect(tokens['secondary']).toBeTruthy();
      expect(tokens['color-on-secondary']).toBeTruthy();
      expect(contrast(tokens['secondary']!, tokens['bg']!), `secondary vis ${mode}`).toBeGreaterThanOrEqual(2.3);
      // Button legibility: on-secondary readable on the secondary fill.
      expect(contrast(tokens['color-on-secondary']!, tokens['secondary']!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the harmony scheme drives the category accents (purple/teal/pink)', () => {
    const accent = '#2f6fed';
    const analogous = recipeToTokens(recipeFromPal(accent, 'light', 'analogous')).tokens;
    const triadic = recipeToTokens(recipeFromPal(accent, 'light', 'triadic')).tokens;
    // Category slots are emitted and differ by scheme (not the fixed defaults).
    expect(analogous['purple']).toBeTruthy();
    expect(analogous['teal']).toBeTruthy();
    expect(analogous['pink']).toBeTruthy();
    expect(triadic['teal']).not.toBe(analogous['teal']);
    // Still canonical, still readable as category chips.
    expect(validateTokenOverrides(triadic).invalid).toEqual([]);
    expect(contrast(triadic['purple']!, triadic['bg']!)).toBeGreaterThanOrEqual(2.9);
  });

  it('emits grain only when texture > 0', () => {
    expect(recipeToTokens({ ...defaultRecipe(), texture: 0 }).tokens['grain']).toBeUndefined();
    expect(recipeToTokens({ ...defaultRecipe(), texture: 0.04 }).tokens['grain']).toBe('0.04');
  });

  it('recipeToThemePair generates a coherent light + dark pair from one recipe', () => {
    const r = randomizeRecipe(7);
    const { light, dark } = recipeToThemePair(r);
    expect(light.parentTheme).toBe('base');
    expect(dark.parentTheme).toBe('dark');
    // Same type + fonts across the pair (only color/neutrals differ by mode).
    expect(light.fonts).toEqual(dark.fonts);
    expect(light.tokens['font-display']).toBe(dark.tokens['font-display']);
    expect(light.tokens['text-lg']).toBe(dark.tokens['text-lg']);
    // Different surfaces per mode; both keep links readable.
    expect(light.tokens['bg']).not.toBe(dark.tokens['bg']);
    expect(contrast(light.tokens['color-link']!, light.tokens['bg']!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.tokens['color-link']!, dark.tokens['bg']!)).toBeGreaterThanOrEqual(4.5);
    // Every emitted key canonical in both.
    expect(validateTokenOverrides(light.tokens).invalid).toEqual([]);
    expect(validateTokenOverrides(dark.tokens).invalid).toEqual([]);
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

  it('density actually scales the spacing + body leading (not an inert control)', () => {
    const px = (rem: string): number => parseFloat(rem) * 16;
    const compact = recipeToTokens({ ...defaultRecipe(), density: 'compact' });
    const balanced = recipeToTokens({ ...defaultRecipe(), density: 'balanced' });
    const spacious = recipeToTokens({ ...defaultRecipe(), density: 'spacious' });
    // Spacing grows compact < balanced < spacious for the same base.
    expect(px(compact.tokens['space-8']!)).toBeLessThan(px(balanced.tokens['space-8']!));
    expect(px(balanced.tokens['space-8']!)).toBeLessThan(px(spacious.tokens['space-8']!));
    // Body line-height tracks density too.
    expect(Number(compact.tokens['leading-normal'])).toBeLessThan(Number(spacious.tokens['leading-normal']));
    // Still emits only canonical keys.
    expect(validateTokenOverrides(spacious.tokens).invalid).toEqual([]);
  });

  it('honors spacing base (airy grid doubles the ramp)', () => {
    const tight = recipeToTokens({ ...defaultRecipe(), spaceBase: 4 });
    const airy = recipeToTokens({ ...defaultRecipe(), spaceBase: 8 });
    expect(tight.tokens['space-4']).toBe('1rem'); // 4*4=16px
    expect(airy.tokens['space-4']).toBe('2rem'); // 4*8=32px
  });

  it('neutralHue drives the bg token hue (Phase 2)', () => {
    const { tokens } = recipeToTokens({ ...defaultRecipe(), neutralHue: 120, neutralSat: 14 });
    expect(Math.abs(hexToHsl(tokens['bg']!).h - 120)).toBeLessThan(8);
  });

  it('borders follow the neutral hue, not the accent, when decoupled (audit #3)', () => {
    // Cool accent (~220) + warm neutral (30): the border should read warm, not cool.
    const { tokens } = recipeToTokens({ ...defaultRecipe(), accent: '#2f6fed', mode: 'light', neutralHue: 30, neutralSat: 10 });
    expect(Math.abs(hexToHsl(tokens['border']!).h - 30)).toBeLessThan(20);
  });
});

describe('design archetypes (Phase 3)', () => {
  it('produce materially different token sets (radius + shadow vary)', () => {
    const sets = DESIGN_ARCHETYPES.map((a) => recipeToTokens({ ...defaultRecipe(), ...a.patch }).tokens);
    expect(new Set(sets.map((t) => t['radius'])).size).toBeGreaterThan(1);
    expect(new Set(sets.map((t) => t['shadow-md'])).size).toBeGreaterThan(1);
    expect(new Set(sets.map((t) => t['border-width-default'])).size).toBeGreaterThan(1);
  });

  it('every archetype still emits only canonical tokens and clears text/bg AA', () => {
    for (const a of DESIGN_ARCHETYPES) {
      const { tokens } = recipeToTokens({ ...defaultRecipe(), ...a.patch });
      expect(validateTokenOverrides(tokens).invalid).toEqual([]);
      expect(contrast(tokens['text']!, tokens['bg']!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the neumorphic archetype emits a dual relief shadow', () => {
    const neo = DESIGN_ARCHETYPES.find((a) => a.k === 'neumorphic')!;
    const { tokens } = recipeToTokens({ ...defaultRecipe(), ...neo.patch });
    expect(tokens['shadow-md']!).toMatch(/-\d+px -\d+px/); // negative-offset highlight = dual relief
  });

  it('the component shadow (--shadow-block) follows the recipe shadow style', () => {
    // So a custom theme's buttons/cards reflect its archetype (built-in themes
    // leave --shadow-block at the offset-block default and are unchanged).
    const neo = DESIGN_ARCHETYPES.find((a) => a.k === 'neumorphic')!;
    const { tokens } = recipeToTokens({ ...defaultRecipe(), ...neo.patch });
    expect(tokens['shadow-block']).toBe(tokens['shadow-md']);
    expect(tokens['shadow-block']!).toMatch(/-\d+px -\d+px/);
    expect(tokens['shadow-block-sm']).toBe(tokens['shadow-sm']);
  });
});

describe('treatment: glass + page gradient (advanced-tokens plan)', () => {
  /** Parse `rgba(r, g, b, a)` into { hex, alpha }. */
  function parseRgba(v: string): { hex: string; alpha: number } {
    const m = v.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
    if (!m) throw new Error(`not an rgba(): ${v}`);
    return { hex: rgbToHex(+m[1]!, +m[2]!, +m[3]!), alpha: +m[4]! };
  }

  // Mirror of the schema's bg-image allowlist (validators.ts
  // SAFE_BG_IMAGE_RE) — re-declared so a generator change that would fail
  // the API save goes red HERE, not on the live save path.
  const SAFE_BG_IMAGE_RE = /^(none|(repeating-)?(linear|radial|conic)-gradient\([^"'\\]+\))$/i;

  it('a recipe WITHOUT treatment emits none of the treatment/chrome keys (legacy lock)', () => {
    // I2 invariant: pre-treatment recipes must keep producing the exact same
    // token set. Cheapest complete check: none of the new keys appear.
    const recipes = [defaultRecipe(), ...Array.from({ length: 30 }, (_, i) => randomizeRecipe(i))];
    for (const r of recipes) {
      const { tokens } = recipeToTokens(r);
      expect(tokens['surface-backdrop']).toBeUndefined();
      expect(tokens['bg-image']).toBeUndefined();
      expect(Object.keys(tokens).filter((k) => k.startsWith('cpub-'))).toEqual([]);
      expect(tokens['surface']).toMatch(/^#/); // solid, not rgba
    }
  });

  it('glass 0 / empty treatment is the same as no treatment', () => {
    const off = recipeToTokens({ ...defaultRecipe(), treatment: { glass: 0 } });
    const none = recipeToTokens(defaultRecipe());
    expect(off.tokens).toEqual(none.tokens);
  });

  it('glass emits translucent surface + backdrop + frosted top bar, all canonical', () => {
    const { tokens } = recipeToTokens({ ...defaultRecipe(), treatment: { glass: 0.12 } });
    const surf = parseRgba(tokens['surface']!);
    expect(surf.alpha).toBeCloseTo(0.88, 2);
    expect(tokens['surface-backdrop']).toMatch(/^blur\(\d+px\) saturate\([\d.]+\)$/);
    expect(parseRgba(tokens['cpub-topbar-bg']!).alpha).toBeGreaterThan(surf.alpha);
    expect(tokens['cpub-topbar-blur']).toMatch(/^blur\(\d+px\)$/);
    expect(validateTokenOverrides(tokens).invalid).toEqual([]);
  });

  it('text stays AA against the FLATTENED glass surface for every curated palette, max strength', () => {
    for (const vibe of COLOR_VIBES) {
      for (const p of vibe.pals) {
        const { tokens } = recipeToTokens({
          ...recipeFromPal(p.a, p.mode, p.s),
          treatment: { glass: 0.3, bgGradient: true },
        });
        const surf = parseRgba(tokens['surface']!);
        const flat = blendOver(surf.hex, surf.alpha, tokens['bg']!);
        // Worst case: a glass MODAL panel over the 50% black scrim.
        const scrimFlat = blendOver(surf.hex, surf.alpha, blendOver('#000000', 0.5, tokens['bg']!));
        for (const [label, ground] of [['bg', flat], ['scrim', scrimFlat]] as const) {
          expect(contrast(tokens['text']!, ground), `${vibe.name}/${p.n} text on glass/${label}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(tokens['text-dim']!, ground), `${vibe.name}/${p.n} dim on glass/${label}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('bgGradient emits a url-free gradient that passes the schema allowlist, AA at the far stop', () => {
    const { tokens } = recipeToTokens({ ...defaultRecipe(), treatment: { bgGradient: true } });
    const grad = tokens['bg-image']!;
    expect(grad).toMatch(SAFE_BG_IMAGE_RE);
    expect(grad.toLowerCase()).not.toContain('url');
    // Far stop = bg tinted 7% toward the accent; body text must stay AA on it.
    const far = mixHex(tokens['bg']!, tokens['accent']!, 0.07);
    expect(grad).toContain(far);
    expect(contrast(tokens['text']!, far)).toBeGreaterThanOrEqual(4.5);
  });

  it('the Glass archetype carries treatment and survives the projection', () => {
    const glass = DESIGN_ARCHETYPES.find((a) => a.k === 'glass')!;
    expect(glass.patch.treatment?.glass).toBeGreaterThan(0);
    expect(glass.patch.treatment?.bgGradient).toBe(true);
    const { tokens } = recipeToTokens({ ...defaultRecipe(), ...glass.patch });
    expect(tokens['surface-backdrop']).toBeTruthy();
    expect(tokens['bg-image']).toBeTruthy();
    expect(validateTokenOverrides(tokens).invalid).toEqual([]);
  });

  it('treatment round-trips through recipeToThemePair (per-mode values)', () => {
    const r: ThemeRecipe = { ...defaultRecipe(), treatment: { glass: 0.12, bgGradient: true } };
    const { light, dark } = recipeToThemePair(r);
    for (const g of [light, dark]) {
      expect(g.tokens['surface-backdrop']).toBeTruthy();
      expect(g.tokens['bg-image']).toBeTruthy();
    }
    // Each mode frosts its own surfaces (different rgba bases).
    expect(light.tokens['surface']).not.toBe(dark.tokens['surface']);
    expect(light.tokens['bg-image']).not.toBe(dark.tokens['bg-image']);
  });
});
