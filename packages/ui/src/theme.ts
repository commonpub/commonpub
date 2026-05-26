/**
 * Theme definitions + DOM helpers for applying / reading themes.
 *
 * The design-token registry (what tokens exist, what their defaults are,
 * what input controls render for them) lives in `./tokens.ts`. This file
 * focuses on built-in theme metadata and the small DOM/CSS helpers used
 * by both the SSR middleware and the admin editor.
 */
import { TOKEN_NAMES } from './tokens.js';

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  isDark: boolean;
  /** Theme family for grouping light/dark variants */
  family: string;
}

export const BUILT_IN_THEMES: ThemeDefinition[] = [
  {
    id: 'base',
    name: 'Classic Light',
    description: 'Sharp corners, offset shadows, blue accent — the CommonPub signature',
    isDark: false,
    family: 'classic',
  },
  {
    id: 'dark',
    name: 'Classic Dark',
    description: 'Dark surfaces with the same offset shadow aesthetic',
    isDark: true,
    family: 'classic',
  },
  {
    id: 'generics',
    name: 'Generics',
    description: 'Dark minimal theme with blue accent and soft glow',
    isDark: true,
    family: 'generics',
  },
  {
    id: 'agora',
    name: 'Agora Light',
    description: 'Warm parchment backgrounds, green accent, serif display font',
    isDark: false,
    family: 'agora',
  },
  {
    id: 'agora-dark',
    name: 'Agora Dark',
    description: 'Grove-tinted darks with green accent, serif display font',
    isDark: true,
    family: 'agora',
  },
];

const BUILT_IN_THEME_IDS = new Set(BUILT_IN_THEMES.map((t) => t.id));

export function isBuiltInThemeId(id: string): boolean {
  return BUILT_IN_THEME_IDS.has(id);
}

/** Backwards-compat alias for older callers. Prefer `isBuiltInThemeId`. */
export function isValidThemeId(id: string): boolean {
  return BUILT_IN_THEME_IDS.has(id);
}

/** Apply a theme to a DOM element. Used client-side when the user toggles
 *  light/dark mode and inside the editor preview pane. */
export function applyThemeToElement(
  el: HTMLElement,
  themeId: string,
  overrides?: Record<string, string>,
): void {
  if (themeId === 'base') {
    el.removeAttribute('data-theme');
  } else {
    el.setAttribute('data-theme', themeId);
  }

  // Clear any previous inline overrides on canonical token names
  for (const token of TOKEN_NAMES) {
    el.style.removeProperty(`--${token}`);
  }

  // Apply overrides as inline CSS custom properties. Lenient — allow
  // non-canonical keys (a custom theme can introduce brand tokens like
  // `deveco-portal-purple` that aren't in TOKEN_SPECS).
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      el.style.setProperty(`--${key}`, value);
    }
  }
}

export function getThemeFromElement(el: HTMLElement): {
  themeId: string;
  overrides: Record<string, string>;
} {
  const themeId = el.getAttribute('data-theme') ?? 'base';
  const overrides: Record<string, string> = {};

  for (const token of TOKEN_NAMES) {
    const value = el.style.getPropertyValue(`--${token}`);
    if (value) {
      overrides[token] = value;
    }
  }

  return { themeId, overrides };
}

/**
 * Serialize a token map into a CSS rule body. Used by the SSR middleware
 * to inject custom-theme styles into the document head.
 *
 * Escaping rules (defense-in-depth — admins are the only writers, but
 * we still want a malformed token to fail closed rather than break the
 * page or escape the <style> block):
 *   - keys are stripped to `[a-zA-Z0-9_-]`; empty keys are dropped
 *   - values strip CR/LF (prevents premature rule termination) and
 *     escape `</` (prevents closing the <style> block)
 *   - the function returns the rule body only; the caller wraps it in
 *     `<style>...</style>` (which Vue/Nuxt's useHead does for us)
 *
 * @param selector — e.g. `:root[data-theme="cpub-custom-deveco"]` or just `:root`
 * @param tokens — map of name→value (without leading `--`)
 */
export function tokensToCss(selector: string, tokens: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== 'string') continue;
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeKey) continue;
    const safeVal = value.replace(/[\r\n]/g, ' ').replace(/<\//g, '<\\/');
    lines.push(`  --${safeKey}: ${safeVal};`);
  }
  if (lines.length === 0) return '';
  return `${selector} {\n${lines.join('\n')}\n}`;
}

/** Compute a 5-color preview swatch from a token map (for the picker card). */
export function previewFromTokens(tokens: Record<string, string>, isDark: boolean): {
  bg: string;
  surface: string;
  accent: string;
  text: string;
  border: string;
} {
  const fallbackLight = { bg: '#fafaf9', surface: '#ffffff', accent: '#5b9cf6', text: '#1a1a1a', border: '#1a1a1a' };
  const fallbackDark = { bg: '#111111', surface: '#1a1a1a', accent: '#5b9cf6', text: '#e5e5e3', border: '#444440' };
  const fb = isDark ? fallbackDark : fallbackLight;
  return {
    bg: tokens.bg ?? fb.bg,
    surface: tokens.surface ?? fb.surface,
    accent: tokens.accent ?? fb.accent,
    text: tokens.text ?? fb.text,
    border: tokens.border ?? fb.border,
  };
}

// ---- Re-exports from tokens.ts for back-compat -------------------------
// Older callers (`@commonpub/ui`-facing code) imported these from
// `theme.ts` before the split — re-exporting keeps that working without
// forcing every import to change.
export {
  TOKEN_NAMES,
  TOKEN_SPECS,
  TOKEN_GROUP_LABELS,
  TOKEN_GROUP_ORDER,
  ALIAS_TOKEN_NAMES,
  validateTokenOverrides,
  tokensByGroup,
  getTokenSpec,
} from './tokens.js';
export type { TokenSpec, TokenGroup, TokenKind } from './tokens.js';
