/**
 * Color-harmony schemes — derive companion hues from a single accent.
 * Ported from GAUGE.
 */
import { rotate, setS, adjL, hexToHsl } from './color.js';

export type HarmonyScheme =
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'split'
  | 'tetradic'
  | 'monochrome';

export const HARMONY_SCHEMES: HarmonyScheme[] = [
  'analogous',
  'complementary',
  'triadic',
  'split',
  'tetradic',
  'monochrome',
];

/**
 * Return the companion colors (excluding the accent itself) for a harmony
 * scheme. The first element is the conventional "secondary".
 */
export function harmonyColors(accent: string, scheme: HarmonyScheme): string[] {
  switch (scheme) {
    case 'complementary':
      return [rotate(accent, 180)];
    case 'analogous':
      return [rotate(accent, -32), rotate(accent, 32)];
    case 'triadic':
      return [rotate(accent, 120), rotate(accent, 240)];
    case 'split':
      return [rotate(accent, 156), rotate(accent, 204)];
    case 'tetradic':
      return [rotate(accent, 90), rotate(accent, 180), rotate(accent, 270)];
    case 'monochrome':
      return [adjL(setS(accent, Math.max(20, hexToHsl(accent).s - 30)), -18), adjL(accent, 16)];
    default:
      return [rotate(accent, 180)];
  }
}
