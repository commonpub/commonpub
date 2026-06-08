/**
 * `ThemeRecipe` — the small, serializable set of inputs the wizard edits.
 * Everything in a generated theme is derived from a recipe by
 * `recipeToTokens` (see generate.ts). A recipe is persisted alongside the
 * theme so the wizard can be re-opened with its controls restored.
 */
import { ALL_FONTS } from './fonts.js';
import type { HarmonyScheme } from './harmony.js';
import type { ThemeMode } from './palette.js';
import type { Density, Motion, ShadowStyle } from './scales.js';
import { COLOR_VIBES, TYPE_VIBES, SHAPE_PRESETS, SHADOW_PRESETS, RATIOS, NAME_POOL } from './presets.js';

/** The four typographic roles a recipe assigns. */
export interface RecipeFonts {
  /** Display / headlines. */
  display: string;
  /** Body / reading text. */
  body: string;
  /** UI / labels (informational; maps to mono in the projection). */
  ui: string;
  /** Code / data. */
  code: string;
}

export interface ThemeRecipe {
  mode: ThemeMode;
  accent: string;
  /** Optional hand-picked secondary; when absent the harmony scheme picks one. */
  secondary?: string;
  scheme: HarmonyScheme;
  fonts: RecipeFonts;
  /** Base font size in px (13–19). */
  baseSize: number;
  /** Modular type-scale ratio. */
  ratio: number;
  /** Spacing base unit in px (4 = tight grid, 8 = airy grid). */
  spaceBase: 4 | 8;
  density: Density;
  /** Base corner radius in px (0–28). */
  shapeRadius: number;
  /** Default border width in px (1–4). */
  borderWidth: number;
  shadowStyle: ShadowStyle;
  motion: Motion;
  /** Film-grain overlay opacity (0 = off, ~0.03 subtle, max ~0.12). */
  texture: number;
}

/** A neutral, on-brand starting recipe (CommonPub blue, sharp, dark). */
export function defaultRecipe(): ThemeRecipe {
  return {
    mode: 'dark',
    accent: '#5b9cf6',
    scheme: 'analogous',
    fonts: { display: 'Fraunces', body: 'Inter', ui: 'Space Mono', code: 'JetBrains Mono' },
    baseSize: 16,
    ratio: 1.25,
    spaceBase: 4,
    density: 'balanced',
    shapeRadius: 6,
    borderWidth: 2,
    shadowStyle: 'soft',
    motion: 'snappy',
    texture: 0,
  };
}

// ---- Seeded RNG (deterministic) ---------------------------------------

/** mulberry32 — a tiny deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/**
 * Build a complete, coherent random recipe. Deterministic for a given
 * `seed` (same seed → same recipe), so the UI passes a time-based seed for
 * variety while tests pass a fixed seed. Draws from the curated vibe
 * presets so the result is always a sensible, AA-leaning starting point.
 */
export function randomizeRecipe(seed: number): ThemeRecipe {
  const rng = mulberry32(seed);
  const vibe = pick(rng, COLOR_VIBES);
  const pal = pick(rng, vibe.pals);
  const typeVibe = pick(rng, TYPE_VIBES);
  const set = pick(rng, typeVibe.sets);
  const shape = pick(rng, SHAPE_PRESETS);
  return {
    mode: pal.mode,
    accent: pal.a,
    scheme: pal.s,
    fonts: { display: set.d, body: set.b, ui: set.u, code: set.c },
    baseSize: 16,
    ratio: pick(rng, RATIOS).k,
    spaceBase: rng() < 0.5 ? 4 : 8,
    density: pick(rng, ['compact', 'balanced', 'spacious'] as const),
    shapeRadius: shape.r,
    borderWidth: pick(rng, [1, 2, 2, 3] as const),
    shadowStyle: pick(rng, SHADOW_PRESETS).k,
    motion: pick(rng, ['sharp', 'snappy', 'smooth'] as const),
    // Mostly no grain; occasionally a subtle amount for variety.
    texture: rng() < 0.35 ? Math.round(rng() * 50) / 1000 : 0,
  };
}

/** Pick a workshop-flavored random theme name (deterministic per seed). */
export function randomName(seed: number): string {
  return pick(mulberry32(seed ^ 0x9e3779b9), NAME_POOL);
}

/** Whether a family is in the catalog (guards persisted/imported recipes). */
export function isKnownFont(fam: string): boolean {
  return ALL_FONTS.includes(fam);
}
