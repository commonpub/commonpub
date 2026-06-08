/**
 * recipeToTokens — the projection. Turns a `ThemeRecipe` into a CommonPub
 * custom-theme token override map, keyed by the canonical token names from
 * `@commonpub/ui` (`packages/ui/src/tokens.ts`). The output is exactly what
 * a custom theme stores in `tokens` and the SSR middleware injects as
 * `:root[data-theme="cpub-custom-<id>"] { ... }`.
 *
 * DESIGN: we only emit the tokens the recipe actually derives. Everything
 * else (the secondary semantic palette purple/teal/pink, medal colors,
 * code-block colors, font weights, line-heights, tracking, layout sizes,
 * z-index) is intentionally NOT emitted — it inherits from `parentTheme`'s
 * CSS. `parentTheme` is chosen to match the recipe's mode (`dark` for dark
 * recipes, `base` for light) so those inherited values are mode-correct.
 *
 * MAPPING (gauge semantic ramp → CommonPub token):
 *   bg/surface/surface2          → bg / surface / surface2 (+ surface3 derived)
 *   text/textSoft/textMuted      → text / text-dim / text-faint
 *   onAccent                     → color-text-inverse + color-on-accent /
 *                                  -on-primary / -primary-text / -accent-text
 *   accent/accentHover           → accent + color-primary-hover /
 *                                  color-accent-hover / color-link-hover
 *   accent (alpha ladder)        → accent-bg / -border / -bg-strong / -heavy /
 *                                  -solid / accent-focus-ring / color-link
 *   success/warning/error        → green / yellow / red (+ each *-bg / *-border)
 *   fonts.display                → font-display + font-heading
 *   fonts.body                   → font-body + font-sans
 *   fonts.code                   → font-mono   (fonts.ui is preview-only)
 *   typeScale                    → text-xs … text-6xl (rem)
 *   spaceBase                    → space-1 … space-24 (rem)
 *   shapeRadius / borderWidth    → radius(+sm/md/lg/xl/2xl) / border-width-*
 *   shadowStyle                  → shadow-sm/md/lg/xl + shadow-accent + focus
 *   motion                       → transition-fast/default/slow
 */
import { hexToHsl, hslToHex, rgba, adjL } from './color.js';
import { buildPalette, type SemanticPalette } from './palette.js';
import { fontStack, googleHref } from './fonts.js';
import {
  typeScale,
  radiusScale,
  buildShadows,
  motionTokens,
  type TypeStep,
} from './scales.js';
import type { ThemeRecipe } from './recipe.js';

export interface GeneratedTheme {
  /** Canonical token name (no leading `--`) → CSS value. */
  tokens: Record<string, string>;
  /** Google-Font families to load for this theme. */
  fonts: string[];
  /** Built-in theme whose CSS provides the inherited (non-emitted) tokens. */
  parentTheme: 'base' | 'dark';
  /** Ready-to-use Google Fonts stylesheet URL (empty if no web fonts). */
  fontHref: string;
}

/** px → rem string, trimmed. */
function rem(px: number): string {
  return `${Math.round((px / 16) * 1000) / 1000}rem`;
}

/** CommonPub spacing slots — the numeric suffix is the multiple of the unit. */
const SPACE_SLOTS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24] as const;

/** Map the gauge type ramp onto CommonPub's `text-*` slots. */
const TYPE_SLOT: Record<TypeStep, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  md: 'text-md',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
  '5xl': 'text-5xl',
  '6xl': 'text-6xl',
};

/** A solid border color tinted by the accent hue, mode-aware. */
function borderColors(hue: number, sat: number, dark: boolean): { strong: string; soft: string } {
  if (dark) {
    return {
      strong: hslToHex(hue, Math.min(sat, 18), 30),
      soft: hslToHex(hue, Math.min(sat, 14), 22),
    };
  }
  return {
    strong: hslToHex(hue, Math.min(sat, 22), 20),
    soft: hslToHex(hue, Math.min(sat, 14), 84),
  };
}

function durationMs(dur: string): number {
  const n = parseInt(dur, 10);
  return Number.isFinite(n) ? n : 160;
}

export function recipeToTokens(recipe: ThemeRecipe): GeneratedTheme {
  const dark = recipe.mode === 'dark';
  const pal = buildPalette({
    accent: recipe.accent,
    secondary: recipe.secondary ?? null,
    scheme: recipe.scheme,
    mode: recipe.mode,
  });
  const s: SemanticPalette = pal.sem;
  const ah = hexToHsl(recipe.accent);
  const t: Record<string, string> = {};

  // ---- Surfaces ----
  t['bg'] = s.bg;
  t['surface'] = s.surface;
  t['surface2'] = s.surface2;
  t['surface3'] = adjL(s.surface2, dark ? 4 : -4);
  t['color-surface-scrim'] = rgba(s.bg, 0.75);

  // ---- Text ----
  t['text'] = s.text;
  t['text-dim'] = s.textSoft;
  t['text-faint'] = s.textMuted;
  t['color-text-inverse'] = s.onAccent;

  // ---- Borders ----
  const bc = borderColors(ah.h, ah.s, dark);
  t['border'] = bc.strong;
  t['border2'] = bc.soft;

  // ---- Accent ----
  t['accent'] = s.accent;
  t['color-primary-hover'] = s.accentHover;
  t['color-accent-hover'] = s.accentHover;
  t['color-link'] = s.accent;
  t['color-link-hover'] = s.accentHover;
  t['accent-bg'] = rgba(s.accent, dark ? 0.12 : 0.08);
  t['accent-border'] = rgba(s.accent, 0.25);
  t['accent-bg-strong'] = rgba(s.accent, 0.2);
  t['accent-bg-heavy'] = rgba(s.accent, 0.4);
  t['accent-bg-solid'] = rgba(s.accent, 0.6);
  t['accent-focus-ring'] = `0 0 0 3px ${rgba(s.accent, 0.12)}`;
  t['color-on-accent'] = s.onAccent;
  t['color-on-primary'] = s.onAccent;
  t['color-primary-text'] = s.onAccent;
  t['color-accent-text'] = s.onAccent;

  // ---- Semantic (success/warning/error only; rest inherits) ----
  const sem: Array<[string, string]> = [
    ['green', s.success],
    ['yellow', s.warning],
    ['red', s.error],
  ];
  for (const [name, hex] of sem) {
    t[name] = hex;
    t[`${name}-bg`] = rgba(hex, 0.08);
    t[`${name}-border`] = rgba(hex, 0.25);
  }

  // ---- Typography: families ----
  t['font-display'] = fontStack(recipe.fonts.display);
  t['font-heading'] = fontStack(recipe.fonts.display);
  t['font-body'] = fontStack(recipe.fonts.body);
  t['font-sans'] = fontStack(recipe.fonts.body);
  t['font-mono'] = fontStack(recipe.fonts.code);

  // ---- Typography: sizes ----
  const ts = typeScale(recipe.baseSize, recipe.ratio);
  for (const step of Object.keys(ts) as TypeStep[]) {
    t[TYPE_SLOT[step]] = rem(ts[step]);
  }

  // ---- Spacing ----
  for (const slot of SPACE_SLOTS) {
    t[`space-${slot}`] = rem(slot * recipe.spaceBase);
  }

  // ---- Shape ----
  const rs = radiusScale(recipe.shapeRadius);
  t['radius'] = `${recipe.shapeRadius}px`;
  t['radius-sm'] = `${rs.sm}px`;
  t['radius-md'] = `${rs.md}px`;
  t['radius-lg'] = `${rs.lg}px`;
  t['radius-xl'] = `${rs.xl}px`;
  t['radius-2xl'] = `${rs['2xl']}px`;
  t['border-width-thin'] = `${Math.max(1, recipe.borderWidth - 1)}px`;
  t['border-width-default'] = `${recipe.borderWidth}px`;
  t['border-width-thick'] = `${recipe.borderWidth + 1}px`;

  // ---- Shadows ----
  const sh = buildShadows(recipe.shadowStyle, recipe.borderWidth, recipe.mode, s);
  t['shadow-sm'] = sh.sm;
  t['shadow-md'] = sh.md;
  t['shadow-lg'] = sh.lg;
  t['shadow-xl'] = sh.xl;
  if (recipe.shadowStyle === 'hard') {
    const n = recipe.borderWidth;
    t['shadow-accent'] = `${n}px ${n}px 0 ${s.accent}`;
  } else {
    t['shadow-accent'] = `0 4px 18px ${s.accentGlow}`;
  }

  // ---- Motion ----
  const mt = motionTokens(recipe.motion);
  const ms = durationMs(mt.dur);
  t['transition-fast'] = `${Math.round(ms * 0.6)}ms ${mt.ease}`;
  t['transition-default'] = `${ms}ms ${mt.ease}`;
  t['transition-slow'] = `${ms * 2}ms ${mt.ease}`;

  // ---- Fonts to load ----
  const fonts = [recipe.fonts.display, recipe.fonts.body, recipe.fonts.ui, recipe.fonts.code].filter(
    (f, i, a) => f && a.indexOf(f) === i,
  );

  return {
    tokens: t,
    fonts,
    parentTheme: dark ? 'dark' : 'base',
    fontHref: googleHref(fonts),
  };
}
