/**
 * sanitizeRenderTokens — the SINK-side guard for `--bg-image`. The themes
 * POST/PUT validate on write, but the token map has other write paths (the
 * generic admin settings route writes instance_settings keys wholesale), so
 * the SSR render path must enforce the same gradient-only allowlist before
 * injection. A dropped key falls back to base.css `none`.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeRenderTokens } from '../instanceTheme';

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
