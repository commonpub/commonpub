import { describe, it, expect, beforeEach } from 'vitest';
import {
  BUILT_IN_THEMES,
  TOKEN_NAMES,
  isValidThemeId,
  validateTokenOverrides,
  applyThemeToElement,
  getThemeFromElement,
} from '../theme';

describe('BUILT_IN_THEMES', () => {
  it('should contain 5 themes', () => {
    expect(BUILT_IN_THEMES).toHaveLength(5);
  });

  it('should include base, dark, generics, agora, agora-dark', () => {
    const ids = BUILT_IN_THEMES.map((t) => t.id);
    expect(ids).toContain('base');
    expect(ids).toContain('dark');
    expect(ids).toContain('generics');
    expect(ids).toContain('agora');
    expect(ids).toContain('agora-dark');
  });

  it('should mark dark themes correctly', () => {
    const dark = BUILT_IN_THEMES.find((t) => t.id === 'dark');
    expect(dark?.isDark).toBe(true);
    const generics = BUILT_IN_THEMES.find((t) => t.id === 'generics');
    expect(generics?.isDark).toBe(true);
    const agoraDark = BUILT_IN_THEMES.find((t) => t.id === 'agora-dark');
    expect(agoraDark?.isDark).toBe(true);
  });

  it('should mark light themes correctly', () => {
    const base = BUILT_IN_THEMES.find((t) => t.id === 'base');
    expect(base?.isDark).toBe(false);
    const agora = BUILT_IN_THEMES.find((t) => t.id === 'agora');
    expect(agora?.isDark).toBe(false);
  });

  it('should assign correct families', () => {
    const base = BUILT_IN_THEMES.find((t) => t.id === 'base');
    expect(base?.family).toBe('classic');
    const dark = BUILT_IN_THEMES.find((t) => t.id === 'dark');
    expect(dark?.family).toBe('classic');
    const agora = BUILT_IN_THEMES.find((t) => t.id === 'agora');
    expect(agora?.family).toBe('agora');
    const agoraDark = BUILT_IN_THEMES.find((t) => t.id === 'agora-dark');
    expect(agoraDark?.family).toBe('agora');
    const generics = BUILT_IN_THEMES.find((t) => t.id === 'generics');
    expect(generics?.family).toBe('generics');
  });
});

describe('isValidThemeId', () => {
  it('should return true for built-in theme IDs', () => {
    expect(isValidThemeId('base')).toBe(true);
    expect(isValidThemeId('dark')).toBe(true);
    expect(isValidThemeId('generics')).toBe(true);
    expect(isValidThemeId('agora')).toBe(true);
    expect(isValidThemeId('agora-dark')).toBe(true);
  });

  it('should return false for unknown theme IDs', () => {
    expect(isValidThemeId('custom')).toBe(false);
    expect(isValidThemeId('')).toBe(false);
    expect(isValidThemeId('BASE')).toBe(false);
    expect(isValidThemeId('deepwood')).toBe(false);
  });
});

describe('TOKEN_NAMES', () => {
  it('should contain core unified-v2 tokens', () => {
    expect(TOKEN_NAMES).toContain('bg');
    expect(TOKEN_NAMES).toContain('surface');
    expect(TOKEN_NAMES).toContain('surface2');
    expect(TOKEN_NAMES).toContain('surface3');
    expect(TOKEN_NAMES).toContain('text');
    expect(TOKEN_NAMES).toContain('text-dim');
    expect(TOKEN_NAMES).toContain('text-faint');
    expect(TOKEN_NAMES).toContain('border');
    expect(TOKEN_NAMES).toContain('border2');
    expect(TOKEN_NAMES).toContain('accent');
    expect(TOKEN_NAMES).toContain('accent-bg');
    expect(TOKEN_NAMES).toContain('accent-border');
  });

  it('should contain semantic color tokens', () => {
    expect(TOKEN_NAMES).toContain('green');
    expect(TOKEN_NAMES).toContain('yellow');
    expect(TOKEN_NAMES).toContain('red');
    expect(TOKEN_NAMES).toContain('purple');
    expect(TOKEN_NAMES).toContain('teal');
    expect(TOKEN_NAMES).toContain('pink');
  });

  it('should contain shadow tokens including accent shadow', () => {
    expect(TOKEN_NAMES).toContain('shadow-sm');
    expect(TOKEN_NAMES).toContain('shadow-md');
    expect(TOKEN_NAMES).toContain('shadow-lg');
    expect(TOKEN_NAMES).toContain('shadow-accent');
  });

  it('should contain backward-compatible aliases', () => {
    expect(TOKEN_NAMES).toContain('color-primary');
    expect(TOKEN_NAMES).toContain('font-heading');
    expect(TOKEN_NAMES).toContain('space-4');
    expect(TOKEN_NAMES).toContain('radius-md');
    expect(TOKEN_NAMES).toContain('z-modal');
    expect(TOKEN_NAMES).toContain('nav-height');
  });

  it('should contain typography tokens including label size and font-display', () => {
    expect(TOKEN_NAMES).toContain('text-label');
    expect(TOKEN_NAMES).toContain('font-sans');
    expect(TOKEN_NAMES).toContain('font-mono');
    expect(TOKEN_NAMES).toContain('font-display');
  });
});

describe('validateTokenOverrides', () => {
  it('should accept valid token names', () => {
    const result = validateTokenOverrides({ 'accent': '#ff0000', 'font-sans': 'Arial' });
    expect(result.valid).toEqual({ 'accent': '#ff0000', 'font-sans': 'Arial' });
    expect(result.invalid).toHaveLength(0);
  });

  it('should accept font-display as valid token', () => {
    const result = validateTokenOverrides({ 'font-display': 'Georgia, serif' });
    expect(result.valid).toEqual({ 'font-display': 'Georgia, serif' });
    expect(result.invalid).toHaveLength(0);
  });

  it('should reject invalid token names', () => {
    const result = validateTokenOverrides({ 'accent': '#ff0000', 'not-a-token': 'value' });
    expect(result.valid).toEqual({ 'accent': '#ff0000' });
    expect(result.invalid).toEqual(['not-a-token']);
  });

  it('should handle empty overrides', () => {
    const result = validateTokenOverrides({});
    expect(result.valid).toEqual({});
    expect(result.invalid).toHaveLength(0);
  });
});

describe('applyThemeToElement', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('should set data-theme attribute for non-base themes', () => {
    applyThemeToElement(el, 'dark');
    expect(el.getAttribute('data-theme')).toBe('dark');
  });

  it('should set data-theme attribute for agora themes', () => {
    applyThemeToElement(el, 'agora');
    expect(el.getAttribute('data-theme')).toBe('agora');

    applyThemeToElement(el, 'agora-dark');
    expect(el.getAttribute('data-theme')).toBe('agora-dark');
  });

  it('should remove data-theme attribute for base theme', () => {
    el.setAttribute('data-theme', 'dark');
    applyThemeToElement(el, 'base');
    expect(el.hasAttribute('data-theme')).toBe(false);
  });

  it('should apply token overrides as inline styles', () => {
    applyThemeToElement(el, 'dark', { 'accent': '#ff0000' });
    expect(el.style.getPropertyValue('--accent')).toBe('#ff0000');
  });

  it('should clear previous overrides when switching themes', () => {
    applyThemeToElement(el, 'dark', { 'accent': '#ff0000' });
    applyThemeToElement(el, 'generics');
    expect(el.style.getPropertyValue('--accent')).toBe('');
  });
});

describe('getThemeFromElement', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
  });

  it('should return base when no data-theme set', () => {
    const result = getThemeFromElement(el);
    expect(result.themeId).toBe('base');
    expect(result.overrides).toEqual({});
  });

  it('should return the data-theme value', () => {
    el.setAttribute('data-theme', 'dark');
    const result = getThemeFromElement(el);
    expect(result.themeId).toBe('dark');
  });

  it('should return agora theme from data-theme', () => {
    el.setAttribute('data-theme', 'agora');
    const result = getThemeFromElement(el);
    expect(result.themeId).toBe('agora');
  });

  it('should return inline token overrides', () => {
    el.setAttribute('data-theme', 'generics');
    el.style.setProperty('--accent', '#custom');
    const result = getThemeFromElement(el);
    expect(result.themeId).toBe('generics');
    expect(result.overrides['accent']).toBe('#custom');
  });
});
