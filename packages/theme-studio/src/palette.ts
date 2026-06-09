/**
 * Palette builder — derive a complete, mode-aware semantic color ramp from
 * a single accent (plus an optional hand-picked secondary and a harmony
 * scheme). Neutrals and text are tinted by the accent hue by default so the
 * whole surface system feels coherent — or by an INDEPENDENT neutral hue/sat
 * (`neutralHue`/`neutralSat`) for variety (warm-cream surfaces under a cool
 * accent, pure-gray, etc.). Ported from GAUGE.
 */
import { hexToHsl, hslToHex, rgba, adjL, clamp, readableOn, ensureReadable } from './color.js';
import { harmonyColors, type HarmonyScheme } from './harmony.js';
import { nameSwatches } from './naming.js';

export type ThemeMode = 'light' | 'dark';

/** The full semantic ramp consumed by the token projection + preview. */
export interface SemanticPalette {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  textSoft: string;
  textMuted: string;
  textGhost: string;
  /** Brand accent, floored to stay visible against `bg` for this mode. */
  accent: string;
  accentHover: string;
  accentDim: string;
  onAccent: string;
  /** Accent darkened/lightened to read as AA text (links, accent-colored text) on `bg`. */
  accentText: string;
  /** Secondary brand accent (visible on `bg`). */
  secondary: string;
  secondaryHover: string;
  onSecondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  line: string;
  lineStrong: string;
  accentGlow: string;
}

export interface Palette {
  mode: ThemeMode;
  scheme: HarmonyScheme;
  /** Effective neutral hue/sat actually used for surfaces (for border derivation). */
  neutralHue: number;
  neutralSat: number;
  /** Evocative names for the 8 raw "designer" swatches (sheet preview). */
  names: {
    bg: string;
    surface: string;
    surface2: string;
    text: string;
    textSoft: string;
    textMuted: string;
    accent: string;
    secondary: string;
  };
  /** name → hex for the 8 raw swatches. */
  raw: Record<string, string>;
  /** Companion hues from the harmony scheme. */
  harmony: string[];
  /** The resolved semantic ramp. */
  sem: SemanticPalette;
}

export interface BuildPaletteOptions {
  accent: string;
  secondary?: string | null;
  scheme: HarmonyScheme;
  mode: ThemeMode;
  /**
   * Neutral (surface/text) hue, 0-360. When omitted the neutrals are tinted by
   * the accent hue (the original "coherent" behavior). Setting it decouples the
   * surfaces from the accent — e.g. a warm-cream neutral under a cool accent, or
   * a pure-gray neutral (pair with `neutralSat: 0`).
   */
  neutralHue?: number;
  /** Neutral saturation, 0-100. When omitted, derived from the accent. 0 = pure gray. */
  neutralSat?: number;
}

export function buildPalette(opts: BuildPaletteOptions): Palette {
  const { accent, secondary, scheme, mode } = opts;
  const ah = hexToHsl(accent);
  const tH = ah.h;
  const dark = mode === 'dark';
  const nS = dark ? Math.min(14, ah.s * 0.22 + 5) : Math.min(11, ah.s * 0.18 + 4);
  // Neutral hue/sat: independent of the accent when the recipe provides them.
  // Saturation is clamped so a crafted/extreme value can't make a garish page.
  const nH = opts.neutralHue ?? tH;
  const nSat = Math.min(22, opts.neutralSat ?? nS);

  let bg: string;
  let surface: string;
  let surface2: string;
  let text: string;
  let textSoft: string;
  let textMuted: string;
  let textGhost: string;
  let line: string;
  let lineStrong: string;

  if (dark) {
    bg = hslToHex(nH, nSat, 6.5);
    surface = hslToHex(nH, nSat, 10.5);
    surface2 = hslToHex(nH, nSat, 14.5);
    text = hslToHex(nH, Math.min(10, nSat), 93);
    textSoft = hslToHex(nH, Math.min(9, nSat), 68);
    textMuted = hslToHex(nH, Math.min(8, nSat), 46);
    textGhost = hslToHex(nH, Math.min(8, nSat), 31);
    line = rgba('#ffffff', 0.09);
    lineStrong = rgba('#ffffff', 0.18);
  } else {
    bg = hslToHex(nH, Math.max(6, nSat - 2), 97);
    surface = hslToHex(nH, Math.max(4, nSat - 3), 99.5);
    surface2 = hslToHex(nH, nSat, 93.5);
    text = hslToHex(nH, Math.min(16, nSat + 6), 12);
    textSoft = hslToHex(nH, Math.min(12, nSat + 2), 34);
    textMuted = hslToHex(nH, Math.min(9, nSat), 52);
    textGhost = hslToHex(nH, Math.min(7, nSat), 68);
    line = rgba(hslToHex(nH, 30, 25), 0.13);
    lineStrong = rgba(hslToHex(nH, 30, 22), 0.26);
  }

  // Effective accent: floor the brand accent so it stays visible as a fill /
  // border against this mode's bg (UI-component contrast ~2.4:1). For most
  // accents this is a no-op; it only kicks in for an accent that would be
  // near-invisible on this mode's page (e.g. a pale accent on a light bg).
  const ea = ensureReadable(accent, bg, 2.4, dark);
  const eah = hexToHsl(ea);
  // Accent-as-text (links): nudged further to clear AA (4.5:1) on bg.
  const accentText = ensureReadable(accent, bg, 4.5, dark);

  const accentHover = dark ? adjL(ea, 8) : adjL(ea, -9);
  const accentDim = dark
    ? hslToHex(eah.h, Math.min(eah.s, 60), 18)
    : hslToHex(eah.h, Math.min(eah.s, 55), 90);
  const onAccent = readableOn(ea);
  const sat = clamp(eah.s, 45, 80);
  const success = hslToHex(148, clamp(sat - 8, 40, 62), dark ? 52 : 42);
  const warning = hslToHex(40, clamp(sat, 55, 82), dark ? 56 : 46);
  const error = hslToHex(6, clamp(sat, 58, 78), dark ? 60 : 52);
  const info = hslToHex(206, clamp(sat - 6, 42, 64), dark ? 60 : 50);
  const harmony = harmonyColors(accent, scheme);
  // Secondary accent: the hand-picked color, else the scheme's lead companion.
  // Floored to stay visible on this mode's bg (same treatment as the accent).
  const es = ensureReadable(secondary || harmony[0]!, bg, 2.4, dark);
  const secondaryHover = dark ? adjL(es, 8) : adjL(es, -9);
  const onSecondary = readableOn(es);
  const sec = es;

  const rawHexes = [bg, surface, surface2, text, textSoft, textMuted, ea, sec];
  const names = nameSwatches(rawHexes);
  const nm = (i: number): string => names[i]!;

  return {
    mode,
    scheme,
    neutralHue: nH,
    neutralSat: nSat,
    names: {
      bg: nm(0),
      surface: nm(1),
      surface2: nm(2),
      text: nm(3),
      textSoft: nm(4),
      textMuted: nm(5),
      accent: nm(6),
      secondary: nm(7),
    },
    raw: {
      [nm(0)]: bg,
      [nm(1)]: surface,
      [nm(2)]: surface2,
      [nm(3)]: text,
      [nm(4)]: textSoft,
      [nm(5)]: textMuted,
      [nm(6)]: ea,
      [nm(7)]: sec,
    },
    harmony,
    sem: {
      bg,
      surface,
      surface2,
      text,
      textSoft,
      textMuted,
      textGhost,
      accent: ea,
      accentHover,
      accentDim,
      onAccent,
      accentText,
      secondary: sec,
      secondaryHover,
      onSecondary,
      success,
      warning,
      error,
      info,
      line,
      lineStrong,
      accentGlow: rgba(ea, 0.16),
    },
  };
}

/** One ready-to-apply palette variation suggested from a single accent. */
export interface PaletteSuggestion {
  k: string;
  label: string;
  scheme: HarmonyScheme;
  /** Hand-picked secondary to apply (undefined = scheme-derived). */
  secondary?: string;
  neutralHue?: number;
  neutralSat?: number;
  /** Preview swatches: [bg, surface, accent, secondary, text]. */
  preview: string[];
}

/**
 * From a single accent, derive several harmonized palette OPTIONS that vary the
 * neutral temperature + secondary strategy — so the wizard can offer "pick one"
 * choice instead of abstract scheme/neutral knobs. Each option is fully
 * applicable (its fields map straight onto the recipe).
 */
export function suggestPalettes(accent: string, mode: ThemeMode): PaletteSuggestion[] {
  const specs: Array<{ k: string; label: string; scheme: HarmonyScheme; neutralHue?: number; neutralSat?: number; vivid?: boolean }> = [
    { k: 'classic', label: 'Classic', scheme: 'analogous' },
    { k: 'warm', label: 'Warm', scheme: 'analogous', neutralHue: 30, neutralSat: 8 },
    { k: 'cool', label: 'Cool', scheme: 'analogous', neutralHue: 220, neutralSat: 8 },
    { k: 'mono', label: 'Mono', scheme: 'monochrome', neutralHue: 0, neutralSat: 0 },
    { k: 'vivid', label: 'Vivid', scheme: 'complementary', vivid: true },
  ];
  return specs.map((s) => {
    const base = buildPalette({ accent, scheme: s.scheme, mode, neutralHue: s.neutralHue, neutralSat: s.neutralSat });
    const secondary = s.vivid ? base.harmony[0] : undefined;
    const pal = secondary
      ? buildPalette({ accent, secondary, scheme: s.scheme, mode, neutralHue: s.neutralHue, neutralSat: s.neutralSat })
      : base;
    return {
      k: s.k,
      label: s.label,
      scheme: s.scheme,
      secondary,
      neutralHue: s.neutralHue,
      neutralSat: s.neutralSat,
      preview: [pal.sem.bg, pal.sem.surface, pal.sem.accent, pal.sem.secondary, pal.sem.text],
    };
  });
}
