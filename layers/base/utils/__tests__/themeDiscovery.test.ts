/**
 * themeDiscovery — the capture-banner diff. The load-bearing piece is
 * resolveVarRefs: getComputedStyle substitutes var() references inside
 * custom-property values, so var()-defaulted specs (font-heading, the
 * registered chrome family) must have their defaults resolved the same way
 * before diffing. Without it, a STOCK site reports ~18 phantom overrides
 * and the "capture your theme" banner shows for everyone.
 */
import { describe, it, expect } from 'vitest';
import { resolveVarRefs, estimateLuminance } from '../themeDiscovery';

const BASE: Record<string, string> = {
  '--surface': '#ffffff',
  '--text-dim': '#6b6b66',
  '--font-sans': 'system-ui, -apple-system, sans-serif',
  '--radius': '0px',
  '--cpub-topbar-height': '48px',
};
const get = (name: string): string => BASE[name] ?? '';

describe('resolveVarRefs', () => {
  it('passes literals through untouched', () => {
    expect(resolveVarRefs(get, '#fafaf9')).toBe('#fafaf9');
    expect(resolveVarRefs(get, 'none')).toBe('none');
    expect(resolveVarRefs(get, '4px 4px 0 #1a1a1a')).toBe('4px 4px 0 #1a1a1a');
  });

  it('substitutes single var() references (the chrome-family defaults)', () => {
    expect(resolveVarRefs(get, 'var(--surface)')).toBe('#ffffff');
    expect(resolveVarRefs(get, 'var(--text-dim)')).toBe('#6b6b66');
    expect(resolveVarRefs(get, 'var(--radius)')).toBe('0px');
  });

  it('substitutes var() with a fallback when the property is unset', () => {
    expect(resolveVarRefs(get, 'var(--cpub-topbar-height, 48px)')).toBe('48px');
    expect(resolveVarRefs(get, 'var(--missing, 12px)')).toBe('12px');
  });

  it('resolves embedded var() inside a shorthand', () => {
    expect(resolveVarRefs(get, '2px solid var(--surface)')).toBe('2px solid #ffffff');
  });

  it('resolves chained references within the depth cap', () => {
    const chained = (name: string): string =>
      name === '--a' ? 'var(--b)' : name === '--b' ? '#123456' : '';
    expect(resolveVarRefs(chained, 'var(--a)')).toBe('#123456');
  });
});

describe('estimateLuminance', () => {
  it('parses hex + rgb and falls back to light', () => {
    expect(estimateLuminance('#000000')).toBe(0);
    expect(estimateLuminance('#ffffff')).toBeCloseTo(1, 10);
    expect(estimateLuminance('rgb(0, 0, 0)')).toBe(0);
    expect(estimateLuminance('hsl(0 0% 0%)')).toBeCloseTo(1, 10); // unparsed → light
  });
});
