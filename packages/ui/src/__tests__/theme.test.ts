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

  it('should include generics, base, deepwood, hackbuild, deveco', () => {
    const ids = BUILT_IN_THEMES.map((t) => t.id);
    expect(ids).toContain('generics');
    expect(ids).toContain('base');
    expect(ids).toContain('deepwood');
    expect(ids).toContain('hackbuild');
    expect(ids).toContain('deveco');
  });

  it('should mark generics and deepwood as dark themes', () => {
    const generics = BUILT_IN_THEMES.find((t) => t.id === 'generics');
    expect(generics?.isDark).toBe(true);
    const deepwood = BUILT_IN_THEMES.find((t) => t.id === 'deepwood');
    expect(deepwood?.isDark).toBe(true);
  });

  it('should mark base, hackbuild, deveco as light themes', () => {
    for (const id of ['base', 'hackbuild', 'deveco']) {
      const theme = BUILT_IN_THEMES.find((t) => t.id === id);
      expect(theme?.isDark).toBe(false);
    }
  });
});

describe('isValidThemeId', () => {
  it('should return true for built-in theme IDs', () => {
    expect(isValidThemeId('base')).toBe(true);
    expect(isValidThemeId('deepwood')).toBe(true);
    expect(isValidThemeId('hackbuild')).toBe(true);
    expect(isValidThemeId('deveco')).toBe(true);
  });

  it('should return false for unknown theme IDs', () => {
    expect(isValidThemeId('custom')).toBe(false);
    expect(isValidThemeId('')).toBe(false);
    expect(isValidThemeId('BASE')).toBe(false);
  });
});

describe('TOKEN_NAMES', () => {
  it('should contain all expected token categories', () => {
    expect(TOKEN_NAMES).toContain('color-primary');
    expect(TOKEN_NAMES).toContain('font-heading');
    expect(TOKEN_NAMES).toContain('space-4');
    expect(TOKEN_NAMES).toContain('radius-md');
    expect(TOKEN_NAMES).toContain('shadow-lg');
    expect(TOKEN_NAMES).toContain('z-modal');
    expect(TOKEN_NAMES).toContain('nav-height');
  });
});

describe('validateTokenOverrides', () => {
  it('should accept valid token names', () => {
    const result = validateTokenOverrides({ 'color-primary': '#ff0000', 'font-heading': 'Arial' });
    expect(result.valid).toEqual({ 'color-primary': '#ff0000', 'font-heading': 'Arial' });
    expect(result.invalid).toHaveLength(0);
  });

  it('should reject invalid token names', () => {
    const result = validateTokenOverrides({ 'color-primary': '#ff0000', 'not-a-token': 'value' });
    expect(result.valid).toEqual({ 'color-primary': '#ff0000' });
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
    applyThemeToElement(el, 'deepwood');
    expect(el.getAttribute('data-theme')).toBe('deepwood');
  });

  it('should remove data-theme attribute for base theme', () => {
    el.setAttribute('data-theme', 'deepwood');
    applyThemeToElement(el, 'base');
    expect(el.hasAttribute('data-theme')).toBe(false);
  });

  it('should apply token overrides as inline styles', () => {
    applyThemeToElement(el, 'deepwood', { 'color-primary': '#ff0000' });
    expect(el.style.getPropertyValue('--color-primary')).toBe('#ff0000');
  });

  it('should clear previous overrides when switching themes', () => {
    applyThemeToElement(el, 'deepwood', { 'color-primary': '#ff0000' });
    applyThemeToElement(el, 'hackbuild');
    expect(el.style.getPropertyValue('--color-primary')).toBe('');
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
    el.setAttribute('data-theme', 'hackbuild');
    const result = getThemeFromElement(el);
    expect(result.themeId).toBe('hackbuild');
  });

  it('should return inline token overrides', () => {
    el.setAttribute('data-theme', 'deveco');
    el.style.setProperty('--color-primary', '#custom');
    const result = getThemeFromElement(el);
    expect(result.themeId).toBe('deveco');
    expect(result.overrides['color-primary']).toBe('#custom');
  });
});
