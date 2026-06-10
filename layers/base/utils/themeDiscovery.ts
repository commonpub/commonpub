/**
 * Discovery helpers — read what's currently rendered on the page and
 * diff against the canonical token defaults. Used by the list page to
 * surface "Your site has a custom theme — capture it" when a thin layer
 * app ships its own `:root` overrides via a CSS file.
 *
 * Client-only (reads `document.documentElement` + `getComputedStyle`).
 * Returns empty/safe values on the server.
 */
import { TOKEN_SPECS } from '@commonpub/ui';

export interface DiscoveredTheme {
  count: number;
  tokens: Record<string, string>;
  isDark: boolean;
}

/**
 * Substitute `var(--x)` / `var(--x, fallback)` references in a default
 * value using a property getter (computed style). getComputedStyle returns
 * custom properties with their var() references ALREADY substituted, so a
 * spec default like `var(--surface)` must be resolved the same way before
 * diffing — otherwise every var()-defaulted token (font-heading, the chrome
 * family) reads as "overridden" on a stock site.
 */
export function resolveVarRefs(get: (name: string) => string, value: string): string {
  let out = value;
  for (let i = 0; i < 4 && out.includes('var('); i++) {
    out = out.replace(/var\((--[a-zA-Z0-9_-]+)(?:,\s*([^()]*))?\)/g, (_, name: string, fb?: string) => {
      const v = get(name).trim();
      return v || fb || '';
    });
  }
  return out;
}

/**
 * Read `getComputedStyle(:root)` for every canonical token and return
 * the subset that differs from `TOKEN_SPECS[i].default`.
 */
export function detectAppliedOverrides(): DiscoveredTheme {
  if (typeof window === 'undefined') return { count: 0, tokens: {}, isDark: false };
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const get = (name: string): string => cs.getPropertyValue(name);
  const overrides: Record<string, string> = {};
  for (const spec of TOKEN_SPECS) {
    const actual = cs.getPropertyValue(`--${spec.key}`).trim();
    if (!actual) continue;
    if (normalize(actual) !== normalize(resolveVarRefs(get, spec.default))) {
      overrides[spec.key] = actual;
    }
  }
  const bg = cs.getPropertyValue('--bg').trim() || '#ffffff';
  return {
    count: Object.keys(overrides).length,
    tokens: overrides,
    isDark: estimateLuminance(bg) < 0.5,
  };
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Rec. 709 luma estimate for a color. Accepts `#rgb`, `#rrggbb`,
 * `rgb()`, or `rgba()`. Returns a number in [0, 1]. Anything we can't
 * parse returns 1 (treated as light).
 */
export function estimateLuminance(color: string): number {
  let r = 255, g = 255, b = 255;
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1]!;
    const exp = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    r = parseInt(exp.slice(0, 2), 16);
    g = parseInt(exp.slice(2, 4), 16);
    b = parseInt(exp.slice(4, 6), 16);
  } else {
    const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) {
      r = Number(rgb[1]); g = Number(rgb[2]); b = Number(rgb[3]);
    }
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
