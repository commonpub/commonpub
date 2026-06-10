/**
 * Color math — hex/rgb/hsl conversions, HSL transforms, alpha, and WCAG
 * contrast. Pure functions, no dependencies. Ported and typed from the
 * GAUGE design-system bench.
 *
 * All hex inputs accept `#rgb` or `#rrggbb` (with or without the leading
 * `#`). HSL hue is in degrees (0–360, wrapped), saturation/lightness in
 * percent (0–100, clamped). RGB channels are 0–255.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** WCAG conformance band for a contrast ratio. */
export type WcagBand = 'AAA' | 'AA' | 'AA LG' | 'FAIL';

export function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

export function hexToRgb(h: string): Rgb {
  let s = String(h).replace('#', '');
  if (s.length === 3) {
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const f = (v: number): string => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    switch (mx) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  h /= 360;
  s /= 100;
  l /= 100;
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

export function hexToHsl(h: string): Hsl {
  const { r, g, b } = hexToRgb(h);
  return rgbToHsl(r, g, b);
}

export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(((h % 360) + 360) % 360, clamp(s, 0, 100), clamp(l, 0, 100));
  return rgbToHex(r, g, b);
}

/** Rotate hue by `deg` degrees, preserving saturation + lightness. */
export function rotate(hex: string, deg: number): string {
  const c = hexToHsl(hex);
  return hslToHex(c.h + deg, c.s, c.l);
}

/** Set absolute lightness (0–100). */
export function setL(hex: string, l: number): string {
  const c = hexToHsl(hex);
  return hslToHex(c.h, c.s, l);
}

/** Set absolute saturation (0–100). */
export function setS(hex: string, s: number): string {
  const c = hexToHsl(hex);
  return hslToHex(c.h, s, c.l);
}

/** Adjust lightness by a delta (clamped 0–100). */
export function adjL(hex: string, d: number): string {
  const c = hexToHsl(hex);
  return hslToHex(c.h, c.s, c.l + d);
}

/** Build an `rgba(...)` string from a hex color + alpha (0–1). */
export function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return 'rgba(' + Math.round(r) + ', ' + Math.round(g) + ', ' + Math.round(b) + ', ' + a + ')';
}

/** Linear RGB mix of two hex colors: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const k = clamp(t, 0, 1);
  return rgbToHex(ca.r + (cb.r - ca.r) * k, ca.g + (cb.g - ca.g) * k, ca.b + (cb.b - ca.b) * k);
}

/**
 * Flatten a translucent layer over an opaque backdrop: the hex you would see
 * if `top` were painted at `alpha` over `bottom`. Used to run WCAG checks
 * against what a glass surface ACTUALLY composites to.
 */
export function blendOver(top: string, alpha: number, bottom: string): string {
  return mixHex(bottom, top, clamp(alpha, 0, 1));
}

/** Relative luminance per WCAG 2.x. */
export function relLum(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number): number => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrast(a: string, b: string): number {
  const l1 = relLum(a);
  const l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** Map a contrast ratio to its WCAG band. */
export function wcag(r: number): WcagBand {
  if (r >= 7) return 'AAA';
  if (r >= 4.5) return 'AA';
  if (r >= 3) return 'AA LG';
  return 'FAIL';
}

/** Pick black or white text for the best contrast on `bg`. */
export function readableOn(bg: string): string {
  return contrast(bg, '#ffffff') >= contrast(bg, '#0a0a0a') ? '#ffffff' : '#0a0a0a';
}

/**
 * Nudge `color`'s lightness (preserving hue + saturation) until it reaches at
 * least `ratio` contrast against `bg`. In dark mode we lighten; in light mode
 * we darken — the direction that increases separation from the page. If the
 * target can't be met before clamping at black/white, returns the closest
 * candidate. This is what keeps a generated theme "smart" — e.g. a pale mint
 * accent stays mint but darkens enough to read as a link on a white page,
 * while the same recipe's dark variant keeps the bright mint.
 */
export function ensureReadable(color: string, bg: string, ratio: number, dark: boolean): string {
  if (contrast(color, bg) >= ratio) return color;
  const c = hexToHsl(color);
  const step = dark ? 3 : -3;
  let l = c.l;
  let best = color;
  for (let i = 0; i < 40; i++) {
    l = clamp(l + step, 0, 100);
    const cand = hslToHex(c.h, c.s, l);
    if (contrast(cand, bg) >= ratio) return cand;
    best = cand;
    if (l <= 0 || l >= 100) break;
  }
  return best;
}
