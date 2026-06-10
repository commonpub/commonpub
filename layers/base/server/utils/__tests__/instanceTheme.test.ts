/**
 * sanitizeRenderTokens — the SINK-side guard for `--bg-image`. The themes
 * POST/PUT validate on write, but the token map has other write paths (the
 * generic admin settings route writes instance_settings keys wholesale), so
 * the SSR render path must enforce the same gradient-only allowlist before
 * injection. A dropped key falls back to base.css `none`.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeRenderTokens, resolveRegisteredVariant } from '../instanceTheme';

describe('sanitizeRenderTokens', () => {
  it('passes through maps without bg-image untouched (same reference)', () => {
    const tokens = { accent: '#5b9cf6', 'surface-backdrop': 'blur(12px) saturate(1.35)' };
    expect(sanitizeRenderTokens(tokens)).toBe(tokens);
  });

  it('keeps a gradient bg-image', () => {
    const tokens = { 'bg-image': 'linear-gradient(165deg, #10131a 0%, #131825 100%)' };
    expect(sanitizeRenderTokens(tokens)['bg-image']).toBe(tokens['bg-image']);
  });

  it('drops url()/smuggled bg-image values written via side channels', () => {
    for (const bad of [
      'url(https://evil.example/p.gif)',
      'url(//evil.example/p.gif)',
      'linear-gradient(red, blue), url(x.png)',
      'image-set("https://evil.example/x.png" 1x)',
      '\\75rl(https://evil.example)',
    ]) {
      const out = sanitizeRenderTokens({ accent: '#fff', 'bg-image': bad });
      expect(out['bg-image'], `should drop: ${bad}`).toBeUndefined();
      expect(out['accent']).toBe('#fff'); // other tokens untouched
    }
  });
});

describe('resolveRegisteredVariant', () => {
  const REG = [
    { id: 'deveco', family: 'deveco', isDark: false, pairId: 'deveco-dark' },
    { id: 'deveco-dark', family: 'deveco', isDark: true, pairId: 'deveco' },
    { id: 'solo', family: 'solo', isDark: false },
  ];

  it('no preference keeps the configured theme, exposing the pair', () => {
    const r = resolveRegisteredVariant('deveco', null, REG);
    expect(r).toEqual({
      resolved: 'deveco',
      isDark: false,
      pair: { lightAttr: 'deveco', darkAttr: 'deveco-dark' },
    });
  });

  it('dark preference resolves the REGISTERED dark sibling, not a layer family', () => {
    // The regression this guards: deveco rode the stoa fallback, so the dark
    // cookie produced stoa-dark and the brand theme lost its identity.
    const r = resolveRegisteredVariant('deveco', 'dark', REG);
    expect(r.resolved).toBe('deveco-dark');
    expect(r.isDark).toBe(true);
  });

  it('light preference from the dark default resolves back to the light sibling', () => {
    const r = resolveRegisteredVariant('deveco-dark', 'light', REG);
    expect(r.resolved).toBe('deveco');
    expect(r.isDark).toBe(false);
  });

  it('falls back to family+isDark matching when pairId is absent', () => {
    const noPairIds = REG.map(({ pairId: _p, ...rest }) => rest);
    const r = resolveRegisteredVariant('deveco', 'dark', noPairIds);
    expect(r.resolved).toBe('deveco-dark');
    expect(r.pair).toEqual({ lightAttr: 'deveco', darkAttr: 'deveco-dark' });
  });

  it('a pairless registered theme stays itself in both modes (no pair exposed)', () => {
    expect(resolveRegisteredVariant('solo', 'dark', REG)).toEqual({
      resolved: 'solo', isDark: false, pair: null,
    });
  });

  it('unknown id passes through untouched', () => {
    expect(resolveRegisteredVariant('nope', 'dark', REG)).toEqual({
      resolved: 'nope', isDark: false, pair: null,
    });
  });
});

describe('resolveRegisteredVariant — name convention (no family/pairId)', () => {
  // The minimal registration: two ids named like a pair, nothing else.
  const MINIMAL = [
    { id: 'brand' },
    { id: 'brand-dark' },
  ];

  it('auto-pairs `<id>` with `<id>-dark` and infers dark-ness from the suffix', () => {
    const r = resolveRegisteredVariant('brand', 'dark', MINIMAL);
    expect(r.resolved).toBe('brand-dark');
    expect(r.isDark).toBe(true);
    expect(r.pair).toEqual({ lightAttr: 'brand', darkAttr: 'brand-dark' });
  });

  it('flips back to light from the dark id', () => {
    const r = resolveRegisteredVariant('brand-dark', 'light', MINIMAL);
    expect(r.resolved).toBe('brand');
    expect(r.isDark).toBe(false);
  });

  it('a theme literally named `dark` is treated as dark, no false pairing', () => {
    const r = resolveRegisteredVariant('moody', 'dark', [{ id: 'moody' }]);
    expect(r.resolved).toBe('moody');
    expect(r.pair).toBeNull();
  });
});
