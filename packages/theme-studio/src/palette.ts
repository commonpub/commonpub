/**
 * Palette builder — derive a complete, mode-aware semantic color ramp from
 * a single accent (plus an optional hand-picked secondary and a harmony
 * scheme). Neutrals and text are tinted by the accent hue so the whole
 * surface system feels coherent. Ported from GAUGE.
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
  secondary: string;
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
}

export function buildPalette(opts: BuildPaletteOptions): Palette {
  const { accent, secondary, scheme, mode } = opts;
  const ah = hexToHsl(accent);
  const tH = ah.h;
  const dark = mode === 'dark';
  const nS = dark ? Math.min(14, ah.s * 0.22 + 5) : Math.min(11, ah.s * 0.18 + 4);

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
    bg = hslToHex(tH, nS, 6.5);
    surface = hslToHex(tH, nS, 10.5);
    surface2 = hslToHex(tH, nS, 14.5);
    text = hslToHex(tH, Math.min(10, nS), 93);
    textSoft = hslToHex(tH, Math.min(9, nS), 68);
    textMuted = hslToHex(tH, Math.min(8, nS), 46);
    textGhost = hslToHex(tH, Math.min(8, nS), 31);
    line = rgba('#ffffff', 0.09);
    lineStrong = rgba('#ffffff', 0.18);
  } else {
    bg = hslToHex(tH, Math.max(6, nS - 2), 97);
    surface = hslToHex(tH, Math.max(4, nS - 3), 99.5);
    surface2 = hslToHex(tH, nS, 93.5);
    text = hslToHex(tH, Math.min(16, nS + 6), 12);
    textSoft = hslToHex(tH, Math.min(12, nS + 2), 34);
    textMuted = hslToHex(tH, Math.min(9, nS), 52);
    textGhost = hslToHex(tH, Math.min(7, nS), 68);
    line = rgba(hslToHex(tH, 30, 25), 0.13);
    lineStrong = rgba(hslToHex(tH, 30, 22), 0.26);
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
  const sec = secondary || harmony[0]!;

  const rawHexes = [bg, surface, surface2, text, textSoft, textMuted, ea, sec];
  const names = nameSwatches(rawHexes);
  const nm = (i: number): string => names[i]!;

  return {
    mode,
    scheme,
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
