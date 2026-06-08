/**
 * Numeric scales + style derivations — type ramp, spacing ramp, radius
 * ramp, shadow style, density padding, and motion. Ported from GAUGE.
 */
import { rgba } from './color.js';
import type { SemanticPalette, ThemeMode } from './palette.js';

// ---- Type scale --------------------------------------------------------

/** Step exponents relative to the base size. */
export const TYPE_STEPS = {
  xs: -2,
  sm: -1,
  base: 0,
  md: 0.5,
  lg: 1,
  xl: 1.5,
  '2xl': 2.5,
  '3xl': 3.5,
  '4xl': 4.5,
  '5xl': 5.5,
  '6xl': 6.5,
} as const;

export type TypeStep = keyof typeof TYPE_STEPS;

/**
 * Build a px type ramp from a base size + modular ratio. Steps below floor
 * at 10px. The `md` step sits between `base` and `lg`, matching CommonPub's
 * `--text-md` slot.
 */
export function typeScale(base: number, ratio: number): Record<TypeStep, number> {
  const out = {} as Record<TypeStep, number>;
  for (const k in TYPE_STEPS) {
    const step = TYPE_STEPS[k as TypeStep];
    out[k as TypeStep] = Math.max(10, Math.round(base * Math.pow(ratio, step)));
  }
  return out;
}

// ---- Spacing scale -----------------------------------------------------

/** CommonPub spacing slots → multiple of the base unit. */
export const SPACE_STEPS = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '8': 8,
  '10': 10,
  '12': 12,
  '16': 16,
  '20': 20,
  '24': 24,
} as const;

export type SpaceStep = keyof typeof SPACE_STEPS;

/** Build a px spacing ramp where `space-4` ≈ `base` px. */
export function spaceScale(base: number): Record<SpaceStep, number> {
  const out = {} as Record<SpaceStep, number>;
  for (const k in SPACE_STEPS) {
    out[k as SpaceStep] = (base / 4) * SPACE_STEPS[k as SpaceStep];
  }
  return out;
}

// ---- Radius scale ------------------------------------------------------

export interface RadiusScale {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  full: number;
}

/** Build a radius ramp from a single base radius (px). */
export function radiusScale(b: number): RadiusScale {
  return {
    none: 0,
    sm: Math.round(b * 0.5),
    md: b,
    lg: Math.round(b * 1.6),
    xl: Math.round(b * 2.2),
    '2xl': Math.round(b * 2.8),
    full: 9999,
  };
}

// ---- Shadows -----------------------------------------------------------

export type ShadowStyle = 'none' | 'hard' | 'soft' | 'glow' | 'layered';

export interface ShadowScale {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

/**
 * Build the offset/elevation shadow scale for a shadow style. `hard` uses
 * the strong border color (matching CommonPub's block-shadow aesthetic);
 * `soft`/`layered` blur with a mode-aware tint; `glow` rings the accent.
 */
export function buildShadows(
  style: ShadowStyle,
  borderWidth: number,
  mode: ThemeMode,
  sem: SemanticPalette,
): ShadowScale {
  const shCol = mode === 'dark' ? 'rgba(0,0,0,.55)' : 'rgba(20,20,30,.16)';
  const hardCol = sem.text;
  if (style === 'hard') {
    const n = borderWidth + 1;
    return {
      sm: `${n - 1}px ${n - 1}px 0 ${hardCol}`,
      md: `${n}px ${n}px 0 ${hardCol}`,
      lg: `${n + 2}px ${n + 2}px 0 ${hardCol}`,
      xl: `${n + 4}px ${n + 4}px 0 ${hardCol}`,
    };
  }
  if (style === 'soft') {
    return {
      sm: `0 1px 3px ${shCol}`,
      md: `0 6px 18px ${shCol}`,
      lg: `0 16px 44px ${shCol}`,
      xl: `0 24px 64px ${shCol}`,
    };
  }
  if (style === 'glow') {
    return {
      sm: `0 0 0 1px ${rgba(sem.accent, 0.4)}`,
      md: `0 4px 18px ${sem.accentGlow}`,
      lg: `0 0 36px ${sem.accentGlow}`,
      xl: `0 0 52px ${sem.accentGlow}`,
    };
  }
  if (style === 'layered') {
    return {
      sm: `0 1px 2px ${shCol}`,
      md: `0 2px 6px ${shCol}, 0 8px 24px ${shCol}`,
      lg: `0 4px 10px ${shCol}, 0 18px 50px ${shCol}`,
      xl: `0 8px 18px ${shCol}, 0 28px 70px ${shCol}`,
    };
  }
  return { sm: 'none', md: 'none', lg: 'none', xl: 'none' };
}

// ---- Density -----------------------------------------------------------

export type Density = 'compact' | 'balanced' | 'spacious';

export interface DensityPad {
  y: number;
  x: number;
  card: number;
  gap: number;
}

/** Button/card padding + gap for a density setting (px). */
export function densityPad(density: Density): DensityPad {
  if (density === 'compact') return { y: 8, x: 14, card: 16, gap: 16 };
  if (density === 'spacious') return { y: 14, x: 24, card: 32, gap: 28 };
  return { y: 11, x: 18, card: 24, gap: 22 };
}

// ---- Motion ------------------------------------------------------------

export type Motion = 'sharp' | 'snappy' | 'smooth';

export interface MotionTokens {
  ease: string;
  dur: string;
}

/** Easing curve + duration for a motion character. */
export function motionTokens(motion: Motion): MotionTokens {
  const ease =
    motion === 'smooth'
      ? 'cubic-bezier(.4,0,.2,1)'
      : motion === 'sharp'
        ? 'cubic-bezier(.2,0,0,1)'
        : 'cubic-bezier(.22,1,.36,1)';
  const dur = motion === 'sharp' ? '90ms' : motion === 'smooth' ? '260ms' : '160ms';
  return { ease, dur };
}
