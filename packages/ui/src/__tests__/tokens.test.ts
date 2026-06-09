/**
 * Coverage for the design-token registry + the new editor-facing helpers
 * landed in session 154 (`TOKEN_SPECS`, `tokensByGroup`, `getTokenSpec`,
 * `isBuiltInThemeId`, `tokensToCss`, `previewFromTokens`).
 *
 * The legacy `theme.test.ts` already covers `BUILT_IN_THEMES`,
 * `TOKEN_NAMES`, `validateTokenOverrides`, and the DOM apply/read
 * helpers — those don't need duplicating here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  TOKEN_SPECS,
  TOKEN_GROUP_LABELS,
  TOKEN_GROUP_ORDER,
  ALIAS_TOKEN_NAMES,
  getTokenSpec,
  tokensByGroup,
} from '../tokens';
import { isBuiltInThemeId, tokensToCss, previewFromTokens } from '../theme';

// Same cwd-walk as radius-model.test.ts (vitest stubs `?raw` CSS imports).
function readBaseCss(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    for (const rel of ['theme/base.css', 'packages/ui/theme/base.css']) {
      const p = resolve(dir, rel);
      if (existsSync(p)) return readFileSync(p, 'utf8');
    }
    dir = dirname(dir);
  }
  throw new Error(`base.css not found from ${process.cwd()}`);
}

describe('TOKEN_SPECS', () => {
  it('lists at least one spec per group in TOKEN_GROUP_ORDER', () => {
    const grouped = tokensByGroup();
    for (const group of TOKEN_GROUP_ORDER) {
      expect(grouped[group].length, `group "${group}" should have specs`).toBeGreaterThan(0);
    }
  });

  it('has unique keys', () => {
    const keys = TOKEN_SPECS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has a label entry for every group used', () => {
    const usedGroups = new Set(TOKEN_SPECS.map((s) => s.group));
    for (const g of usedGroups) {
      expect(TOKEN_GROUP_LABELS[g], `missing label for group "${g}"`).toBeDefined();
    }
  });

  it('exposes essential brand tokens for the editor', () => {
    expect(getTokenSpec('accent')).toBeDefined();
    expect(getTokenSpec('bg')).toBeDefined();
    expect(getTokenSpec('font-sans')).toBeDefined();
    expect(getTokenSpec('shadow-md')).toBeDefined();
  });

  it('returns undefined for unknown keys', () => {
    expect(getTokenSpec('totally-made-up')).toBeUndefined();
  });
});

describe('chrome + treatment + new layout tokens (advanced-tokens plan)', () => {
  const baseCss = readBaseCss();

  /** First `--<key>: <value>;` declaration in base.css (the :root default). */
  function cssDefault(key: string): string | undefined {
    const m = baseCss.match(new RegExp(`--${key}:\\s*([^;]+);`));
    return m?.[1]?.trim();
  }

  const NEW_KEYS = [
    // treatment
    'surface-backdrop', 'bg-image',
    // layout additions
    'sidebar-width-collapsed', 'cpub-card-min', 'cpub-card-gap',
    // chrome family
    'cpub-topbar-height', 'cpub-topbar-bg', 'cpub-topbar-border',
    'cpub-topbar-radius', 'cpub-topbar-shadow', 'cpub-topbar-position',
    'cpub-topbar-padding-x', 'cpub-topbar-blur', 'cpub-content-top-offset',
    'cpub-nav-link-size', 'cpub-nav-link-weight', 'cpub-nav-link-padding',
    'cpub-nav-link-radius', 'cpub-nav-link-color', 'cpub-nav-link-active-color',
    'cpub-nav-link-active-bg', 'cpub-nav-link-active-weight', 'cpub-nav-link-active-border',
    'cpub-footer-bg', 'cpub-footer-text', 'cpub-footer-muted',
    'cpub-footer-border', 'cpub-footer-link-hover', 'cpub-footer-heading',
  ];

  it('every new token is registered AND its default matches base.css verbatim', () => {
    for (const key of NEW_KEYS) {
      const spec = getTokenSpec(key);
      expect(spec, `"${key}" should be in TOKEN_SPECS`).toBeDefined();
      const css = cssDefault(key);
      expect(css, `"--${key}" should be declared in base.css`).toBeDefined();
      expect(spec!.default, `default for "${key}" must match base.css`).toBe(css);
    }
  });

  it('treatment defaults are true no-ops (none, not blur(0))', () => {
    // backdrop-filter: blur(0) creates a stacking context + containing block
    // for fixed descendants; only `none` is a real no-op.
    expect(getTokenSpec('surface-backdrop')!.default).toBe('none');
    expect(getTokenSpec('bg-image')!.default).toBe('none');
    expect(getTokenSpec('cpub-topbar-blur')!.default).toBe('none');
  });

  it('base.css applies the treatment hooks where the tokens promise', () => {
    expect(baseCss).toContain('background-image: var(--bg-image, none)');
  });
});

describe('ALIAS_TOKEN_NAMES', () => {
  it('preserves backward-compat tokens that base.css still emits', () => {
    expect(ALIAS_TOKEN_NAMES).toContain('color-primary');
    expect(ALIAS_TOKEN_NAMES).toContain('color-text');
    expect(ALIAS_TOKEN_NAMES).toContain('color-surface');
    expect(ALIAS_TOKEN_NAMES).toContain('color-success');
  });

  it('does not duplicate canonical spec keys', () => {
    const canonical = new Set(TOKEN_SPECS.map((s) => s.key));
    for (const alias of ALIAS_TOKEN_NAMES) {
      expect(canonical.has(alias), `alias "${alias}" collides with a canonical key`).toBe(false);
    }
  });
});

describe('isBuiltInThemeId', () => {
  it('accepts every BUILT_IN_THEMES id', () => {
    expect(isBuiltInThemeId('base')).toBe(true);
    expect(isBuiltInThemeId('dark')).toBe(true);
    expect(isBuiltInThemeId('agora')).toBe(true);
    expect(isBuiltInThemeId('agora-dark')).toBe(true);
    expect(isBuiltInThemeId('generics')).toBe(true);
  });

  it('rejects custom + registered theme ids', () => {
    expect(isBuiltInThemeId('cpub-custom-deveco')).toBe(false);
    expect(isBuiltInThemeId('deveco')).toBe(false);
    expect(isBuiltInThemeId('')).toBe(false);
  });
});

describe('tokensToCss', () => {
  it('serializes a token map into a CSS rule body', () => {
    const css = tokensToCss(':root', { accent: '#ff0000', bg: '#fafafa' });
    expect(css).toContain(':root {');
    expect(css).toContain('--accent: #ff0000;');
    expect(css).toContain('--bg: #fafafa;');
    expect(css).toMatch(/}\s*$/);
  });

  it('returns empty string when nothing to write', () => {
    expect(tokensToCss(':root', {})).toBe('');
  });

  it('skips non-string values defensively', () => {
    // Simulates a malformed DB row where a token slipped through as a number
    const css = tokensToCss(':root', { accent: '#ff0000', bad: 42 as unknown as string });
    expect(css).toContain('--accent: #ff0000;');
    expect(css).not.toContain('--bad:');
  });

  it('strips disallowed characters from token keys', () => {
    const css = tokensToCss(':root', { 'accent;color:red': '#ff0000' } as Record<string, string>);
    // The malformed key gets sanitised to `accentcolorred`
    expect(css).toContain('--accentcolorred: #ff0000;');
    expect(css).not.toContain(';color:red');
  });

  it('drops keys that sanitise to empty', () => {
    const css = tokensToCss(':root', { '!!!': '#ff0000' });
    expect(css).toBe('');
  });

  it('escapes </ in values so the <style> block cannot be terminated early', () => {
    const css = tokensToCss(':root', { accent: 'url("data:</style><script>alert(1)</script>")' });
    expect(css).not.toContain('</style>');
    expect(css).toContain('<\\/style>');
  });

  it('strips newlines from values so they cannot prematurely close a rule', () => {
    const css = tokensToCss(':root', { accent: '#ff0000;\n} body { color: red' });
    // Newline gone, but the lone `;` is left — that's intentional, the
    // declaration body simply becomes the sanitised string. Escaping is
    // defense-in-depth, not bidirectional parsing.
    expect(css).not.toContain('\n} body');
  });

  it('honors the selector argument', () => {
    const css = tokensToCss(':root[data-theme="cpub-custom-foo"]', { accent: '#ff0000' });
    expect(css.startsWith(':root[data-theme="cpub-custom-foo"] {')).toBe(true);
  });
});

describe('previewFromTokens', () => {
  it('returns the supplied tokens when present', () => {
    const p = previewFromTokens(
      { bg: '#000', surface: '#111', accent: '#0f0', text: '#fff', border: '#222' },
      true,
    );
    expect(p).toEqual({ bg: '#000', surface: '#111', accent: '#0f0', text: '#fff', border: '#222' });
  });

  it('falls back to dark defaults when isDark + tokens missing', () => {
    const p = previewFromTokens({}, true);
    expect(p.bg).toBe('#111111');
    expect(p.text).toBe('#e5e5e3');
  });

  it('falls back to light defaults when !isDark + tokens missing', () => {
    const p = previewFromTokens({}, false);
    expect(p.bg).toBe('#fafaf9');
    expect(p.text).toBe('#1a1a1a');
  });

  it('mixes supplied + fallback per field', () => {
    const p = previewFromTokens({ accent: '#ff00ff' }, false);
    expect(p.accent).toBe('#ff00ff');
    expect(p.bg).toBe('#fafaf9'); // fallback
  });
});
