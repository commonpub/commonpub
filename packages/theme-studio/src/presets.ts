/**
 * Curated preset data — the "by vibe" shortcuts the wizard offers for
 * color, type, shape, shadow, scale ratio, and random naming. Ported from
 * GAUGE. These are starting points; every value remains tunable.
 */
import type { HarmonyScheme } from './harmony.js';
import type { ThemeMode } from './palette.js';
import type { ShadowStyle, Density, Motion } from './scales.js';

/** A single palette option inside a color vibe. */
export interface ColorPaletteOption {
  /** Display name. */
  n: string;
  /** Accent hex. */
  a: string;
  mode: ThemeMode;
  /** Harmony scheme. */
  s: HarmonyScheme;
}

export interface ColorVibe {
  name: string;
  pals: ColorPaletteOption[];
}

export const COLOR_VIBES: ColorVibe[] = [
  { name: 'Neo-Mint', pals: [{ n: 'Spearmint', a: '#34d9a0', mode: 'dark', s: 'analogous' }, { n: 'Seafoam', a: '#3fd9b8', mode: 'light', s: 'analogous' }, { n: 'Pistachio', a: '#9bd957', mode: 'light', s: 'complementary' }] },
  { name: 'Mono Noir', pals: [{ n: 'Signal Red', a: '#ff4d4d', mode: 'dark', s: 'monochrome' }, { n: 'Paper Ink', a: '#2b2b2b', mode: 'light', s: 'monochrome' }, { n: 'Ember', a: '#ff7849', mode: 'dark', s: 'monochrome' }] },
  { name: 'Deep Ocean', pals: [{ n: 'Abyssal', a: '#1f8fd6', mode: 'dark', s: 'analogous' }, { n: 'Tidal', a: '#27a3c4', mode: 'dark', s: 'split' }, { n: 'Harbor', a: '#2f6fed', mode: 'light', s: 'analogous' }] },
  { name: 'Forest', pals: [{ n: 'Pine', a: '#2f9e57', mode: 'dark', s: 'analogous' }, { n: 'Fern', a: '#4caf50', mode: 'light', s: 'analogous' }, { n: 'Olive', a: '#7a9e3f', mode: 'dark', s: 'complementary' }] },
  { name: 'Sunset', pals: [{ n: 'Dusk', a: '#ff6b4a', mode: 'dark', s: 'analogous' }, { n: 'Coral', a: '#ff7e67', mode: 'light', s: 'analogous' }, { n: 'Magma', a: '#ef4444', mode: 'dark', s: 'split' }] },
  { name: 'Candy Pop', pals: [{ n: 'Bubblegum', a: '#ff3d8b', mode: 'light', s: 'triadic' }, { n: 'Electric', a: '#ff2e88', mode: 'dark', s: 'complementary' }, { n: 'Punch', a: '#fb5c9a', mode: 'light', s: 'split' }] },
  { name: 'Corporate', pals: [{ n: 'Cobalt', a: '#2563eb', mode: 'light', s: 'complementary' }, { n: 'Navy', a: '#1e40af', mode: 'dark', s: 'analogous' }, { n: 'Steel Blue', a: '#3b6cb7', mode: 'light', s: 'analogous' }] },
  { name: 'Cyber Neon', pals: [{ n: 'Acid', a: '#00e5b0', mode: 'dark', s: 'split' }, { n: 'Voltage', a: '#22d3ee', mode: 'dark', s: 'complementary' }, { n: 'Plasma', a: '#b14bff', mode: 'dark', s: 'triadic' }] },
  { name: 'Pastel', pals: [{ n: 'Lavender', a: '#b39ddb', mode: 'light', s: 'analogous' }, { n: 'Blush', a: '#f2a6c2', mode: 'light', s: 'analogous' }, { n: 'Sky', a: '#9fc8e8', mode: 'light', s: 'split' }] },
  { name: 'Desert', pals: [{ n: 'Terracotta', a: '#c8643c', mode: 'light', s: 'complementary' }, { n: 'Adobe', a: '#d98a3d', mode: 'light', s: 'analogous' }, { n: 'Turquoise', a: '#3fb6a8', mode: 'dark', s: 'split' }] },
  { name: 'Blueprint', pals: [{ n: 'Drafting', a: '#3a7afe', mode: 'dark', s: 'monochrome' }, { n: 'Cyan Line', a: '#22b8cf', mode: 'dark', s: 'analogous' }] },
  { name: 'Royal Plum', pals: [{ n: 'Amethyst', a: '#7c3aed', mode: 'dark', s: 'analogous' }, { n: 'Orchid', a: '#9d4edd', mode: 'dark', s: 'split' }, { n: 'Iris', a: '#6d6af5', mode: 'light', s: 'analogous' }] },
  { name: 'Citrus', pals: [{ n: 'Marigold', a: '#f5a623', mode: 'light', s: 'analogous' }, { n: 'Tangerine', a: '#ff9f1c', mode: 'dark', s: 'complementary' }, { n: 'Honey', a: '#e8b400', mode: 'light', s: 'analogous' }] },
  { name: 'Slate Pro', pals: [{ n: 'Storm', a: '#64748b', mode: 'dark', s: 'complementary' }, { n: 'Gunmetal', a: '#52606d', mode: 'dark', s: 'analogous' }, { n: 'Steel Day', a: '#5b6b7e', mode: 'light', s: 'split' }] },
];

/** A typography role set (display / body / ui / code). */
export interface TypeSet {
  /** Display / headlines. */
  d: string;
  /** Body / content. */
  b: string;
  /** UI / labels. */
  u: string;
  /** Code / data. */
  c: string;
}

export interface TypeVibe {
  name: string;
  sets: TypeSet[];
}

export const TYPE_VIBES: TypeVibe[] = [
  { name: 'Editorial', sets: [{ d: 'Playfair Display', b: 'Source Sans 3', u: 'IBM Plex Mono', c: 'JetBrains Mono' }, { d: 'Cormorant Garamond', b: 'Proza Libre', u: 'Space Mono', c: 'IBM Plex Mono' }, { d: 'DM Serif Display', b: 'DM Sans', u: 'DM Mono', c: 'JetBrains Mono' }, { d: 'Fraunces', b: 'Inter', u: 'Space Mono', c: 'JetBrains Mono' }] },
  { name: 'Modern Product', sets: [{ d: 'Sora', b: 'Inter', u: 'IBM Plex Mono', c: 'JetBrains Mono' }, { d: 'Manrope', b: 'Inter', u: 'JetBrains Mono', c: 'JetBrains Mono' }, { d: 'Plus Jakarta Sans', b: 'Inter', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Outfit', b: 'Hanken Grotesk', u: 'IBM Plex Mono', c: 'Fira Code' }] },
  { name: 'Brutalist', sets: [{ d: 'Space Mono', b: 'Space Mono', u: 'Space Mono', c: 'Space Mono' }, { d: 'Archivo Black', b: 'Archivo', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'IBM Plex Mono', b: 'IBM Plex Mono', u: 'IBM Plex Mono', c: 'IBM Plex Mono' }, { d: 'Syne', b: 'Inter', u: 'Space Mono', c: 'JetBrains Mono' }] },
  { name: 'Friendly', sets: [{ d: 'Fredoka', b: 'Nunito', u: 'Nunito Sans', c: 'JetBrains Mono' }, { d: 'Poppins', b: 'Work Sans', u: 'DM Mono', c: 'JetBrains Mono' }, { d: 'Quicksand', b: 'Mulish', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Baloo 2', b: 'Nunito Sans', u: 'DM Mono', c: 'Fira Code' }] },
  { name: 'Industrial', sets: [{ d: 'Oswald', b: 'Barlow', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Bebas Neue', b: 'Source Sans 3', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Anton', b: 'Roboto', u: 'Roboto Mono', c: 'Roboto Mono' }, { d: 'Archivo Black', b: 'Archivo Narrow', u: 'IBM Plex Mono', c: 'JetBrains Mono' }] },
  { name: 'Terminal', sets: [{ d: 'Space Mono', b: 'JetBrains Mono', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Major Mono Display', b: 'IBM Plex Mono', u: 'IBM Plex Mono', c: 'IBM Plex Mono' }, { d: 'VT323', b: 'Courier Prime', u: 'VT323', c: 'Courier Prime' }, { d: 'DotGothic16', b: 'Space Mono', u: 'Space Mono', c: 'JetBrains Mono' }] },
  { name: 'Literary', sets: [{ d: 'Lora', b: 'Source Sans 3', u: 'IBM Plex Mono', c: 'JetBrains Mono' }, { d: 'Vollkorn', b: 'Lato', u: 'DM Mono', c: 'JetBrains Mono' }, { d: 'Bitter', b: 'Raleway', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Spectral', b: 'Inter', u: 'IBM Plex Mono', c: 'JetBrains Mono' }] },
  { name: 'Geometric', sets: [{ d: 'Montserrat', b: 'Open Sans', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Lexend', b: 'Inter', u: 'IBM Plex Mono', c: 'JetBrains Mono' }, { d: 'Poppins', b: 'Roboto', u: 'Roboto Mono', c: 'Roboto Mono' }, { d: 'Albert Sans', b: 'Figtree', u: 'Space Mono', c: 'Fira Code' }] },
  { name: 'Statement', sets: [{ d: 'Abril Fatface', b: 'Work Sans', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Bricolage Grotesque', b: 'Inter', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Unbounded', b: 'Inter', u: 'JetBrains Mono', c: 'JetBrains Mono' }, { d: 'Big Shoulders Display', b: 'Hanken Grotesk', u: 'IBM Plex Mono', c: 'Fira Code' }] },
  { name: 'Zine / Hand', sets: [{ d: 'Permanent Marker', b: 'Special Elite', u: 'VT323', c: 'Courier Prime' }, { d: 'Caveat', b: 'Karla', u: 'Space Mono', c: 'JetBrains Mono' }, { d: 'Shadows Into Light', b: 'Nunito', u: 'DM Mono', c: 'JetBrains Mono' }, { d: 'Bungee', b: 'Work Sans', u: 'Space Mono', c: 'JetBrains Mono' }] },
];

/** Corner-language preset (maps to a base radius in px). */
export interface ShapePreset {
  k: string;
  label: string;
  sub: string;
  r: number;
}

export const SHAPE_PRESETS: ShapePreset[] = [
  { k: 'sharp', label: 'Sharp', sub: '0px', r: 0 },
  { k: 'soft', label: 'Soft', sub: '6px', r: 6 },
  { k: 'rounded', label: 'Rounded', sub: '12px', r: 12 },
  { k: 'pill', label: 'Pill', sub: '20px', r: 20 },
  { k: 'round', label: 'Round', sub: '28px', r: 28 },
];

export interface ShadowPreset {
  k: ShadowStyle;
  label: string;
  sub: string;
}

export const SHADOW_PRESETS: ShadowPreset[] = [
  { k: 'none', label: 'None', sub: 'flat' },
  { k: 'hard', label: 'Hard', sub: 'block' },
  { k: 'soft', label: 'Soft', sub: 'blur' },
  { k: 'glow', label: 'Glow', sub: 'accent' },
  { k: 'layered', label: 'Layered', sub: 'depth' },
  { k: 'neumorphic', label: 'Neumorphic', sub: 'relief' },
];

// ---- Design-ethos archetypes ------------------------------------------

/**
 * A design ETHOS — a coherent multi-dimension preset that changes shape,
 * shadow, border, type, density, and texture together to express a STYLE
 * (not just a color). Picking one patches those recipe fields in one move;
 * the user keeps their chosen color + can fine-tune everything after. This
 * is what makes generated themes look genuinely different rather than
 * "same theme, different accent". Archetypes are structure-only — they don't
 * set the accent or mode, so any palette can wear any ethos.
 */
export interface ArchetypePatch {
  scheme?: HarmonyScheme;
  fonts?: { display: string; body: string; ui: string; code: string };
  ratio?: number;
  spaceBase?: 4 | 8;
  density?: Density;
  shapeRadius?: number;
  borderWidth?: number;
  shadowStyle?: ShadowStyle;
  motion?: Motion;
  texture?: number;
  neutralSat?: number;
  neutralHue?: number;
}

export interface DesignArchetype {
  k: string;
  label: string;
  /** One-line description of the ethos. */
  sub: string;
  patch: ArchetypePatch;
}

export const DESIGN_ARCHETYPES: DesignArchetype[] = [
  {
    k: 'brutalist',
    label: 'Brutalist',
    sub: 'Sharp, heavy borders, hard offset shadows, mono type',
    patch: {
      scheme: 'monochrome',
      fonts: { display: 'Space Mono', body: 'Space Mono', ui: 'Space Mono', code: 'Space Mono' },
      ratio: 1.25, spaceBase: 4, density: 'balanced',
      shapeRadius: 0, borderWidth: 3, shadowStyle: 'hard', motion: 'sharp', texture: 0,
    },
  },
  {
    k: 'editorial',
    label: 'Editorial',
    sub: 'Serif display, hairline rules, no shadow, generous whitespace',
    patch: {
      scheme: 'monochrome',
      fonts: { display: 'Fraunces', body: 'Inter', ui: 'IBM Plex Mono', code: 'JetBrains Mono' },
      ratio: 1.333, spaceBase: 8, density: 'spacious',
      shapeRadius: 0, borderWidth: 1, shadowStyle: 'none', motion: 'smooth', texture: 0,
    },
  },
  {
    k: 'soft',
    label: 'Soft',
    sub: 'Rounded, gentle blur shadows, friendly sans, roomy',
    patch: {
      scheme: 'analogous',
      fonts: { display: 'Poppins', body: 'Work Sans', ui: 'DM Mono', code: 'JetBrains Mono' },
      ratio: 1.25, spaceBase: 8, density: 'spacious',
      shapeRadius: 14, borderWidth: 1, shadowStyle: 'soft', motion: 'smooth', texture: 0,
    },
  },
  {
    k: 'terminal',
    label: 'Terminal',
    sub: 'Mono everything, glow, grain, tight + sharp',
    patch: {
      scheme: 'split',
      fonts: { display: 'Space Mono', body: 'JetBrains Mono', ui: 'Space Mono', code: 'JetBrains Mono' },
      ratio: 1.2, spaceBase: 4, density: 'compact',
      shapeRadius: 0, borderWidth: 1, shadowStyle: 'glow', motion: 'sharp', texture: 0.03,
    },
  },
  {
    k: 'neumorphic',
    label: 'Neumorphic',
    sub: 'Soft extruded relief, low contrast, rounded',
    patch: {
      scheme: 'monochrome',
      fonts: { display: 'Manrope', body: 'Inter', ui: 'IBM Plex Mono', code: 'JetBrains Mono' },
      ratio: 1.25, spaceBase: 8, density: 'spacious',
      shapeRadius: 16, borderWidth: 0, shadowStyle: 'neumorphic', motion: 'smooth', texture: 0,
    },
  },
];

export interface RatioPreset {
  k: number;
  label: string;
  sub: string;
}

export const RATIOS: RatioPreset[] = [
  { k: 1.2, label: 'Minor 3rd', sub: '1.200' },
  { k: 1.25, label: 'Major 3rd', sub: '1.250' },
  { k: 1.333, label: 'Perfect 4th', sub: '1.333' },
  { k: 1.414, label: 'Aug 4th', sub: '1.414' },
  { k: 1.5, label: 'Perfect 5th', sub: '1.500' },
  { k: 1.618, label: 'Golden', sub: '1.618' },
];

/** Workshop-flavored random theme names. */
export const NAME_POOL: string[] = [
  'KILN', 'TRENCH', 'MERIDIAN', 'SINTER', 'DROSS', 'INGOT', 'LATTICE', 'FILAMENT', 'TERMINUS',
  'LEDGER', 'APERTURE', 'FERRULE', 'GASKET', 'FLUX', 'SPLINE', 'QUENCH', 'MANDREL', 'BURNISH',
  'CHAMFER', 'REAMER', 'GANTRY', 'LINTEL', 'VELLUM', 'CINDER', 'TALLOW', 'SCRIVE', 'BALLAST',
  'KEEL', 'SLUICE', 'COFFER',
];
