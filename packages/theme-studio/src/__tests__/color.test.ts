import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  contrast,
  wcag,
  readableOn,
  rotate,
  ensureReadable,
} from '../color.js';

describe('color conversions', () => {
  it('round-trips hex → rgb → hex', () => {
    expect(rgbToHex(hexToRgb('#5b9cf6').r, hexToRgb('#5b9cf6').g, hexToRgb('#5b9cf6').b)).toBe('#5b9cf6');
  });

  it('expands 3-digit hex', () => {
    expect(hexToRgb('#abc')).toEqual(hexToRgb('#aabbcc'));
  });

  it('round-trips hex → hsl → hex within rounding tolerance', () => {
    const out = hslToHex(hexToHsl('#34d9a0').h, hexToHsl('#34d9a0').s, hexToHsl('#34d9a0').l);
    // Allow a 2-step channel drift from float rounding.
    const a = hexToRgb('#34d9a0');
    const b = hexToRgb(out);
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(2);
  });

  it('rotate(360) is a no-op (within tolerance)', () => {
    const a = hexToRgb('#5b9cf6');
    const b = hexToRgb(rotate('#5b9cf6', 360));
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(2);
  });
});

describe('contrast + WCAG', () => {
  it('black on white is 21:1 (AAA)', () => {
    expect(Math.round(contrast('#000000', '#ffffff'))).toBe(21);
    expect(wcag(contrast('#000000', '#ffffff'))).toBe('AAA');
  });

  it('identical colors are 1:1 (FAIL)', () => {
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(wcag(1)).toBe('FAIL');
  });

  it('bands map at the right thresholds', () => {
    expect(wcag(7)).toBe('AAA');
    expect(wcag(4.5)).toBe('AA');
    expect(wcag(3)).toBe('AA LG');
    expect(wcag(2.9)).toBe('FAIL');
  });

  it('readableOn picks white on dark, near-black on light', () => {
    expect(readableOn('#111111')).toBe('#ffffff');
    expect(readableOn('#fafaf9')).toBe('#0a0a0a');
  });
});

describe('ensureReadable', () => {
  it('leaves an already-readable color unchanged', () => {
    expect(ensureReadable('#1a1a1a', '#ffffff', 4.5, false)).toBe('#1a1a1a');
  });

  it('darkens a pale accent on a light bg until it clears the ratio', () => {
    const out = ensureReadable('#a7f3d0', '#ffffff', 4.5, false); // pale mint on white
    expect(contrast(out, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(hexToHsl(out).l).toBeLessThan(hexToHsl('#a7f3d0').l); // got darker
  });

  it('lightens a dark accent on a dark bg until it clears the ratio', () => {
    const out = ensureReadable('#1e1b4b', '#0c0c0f', 4.5, true); // deep indigo on near-black
    expect(contrast(out, '#0c0c0f')).toBeGreaterThanOrEqual(4.5);
    expect(hexToHsl(out).l).toBeGreaterThan(hexToHsl('#1e1b4b').l); // got lighter
  });

  it('preserves hue while adjusting lightness', () => {
    const out = ensureReadable('#34d9a0', '#ffffff', 4.5, false);
    expect(Math.abs(hexToHsl(out).h - hexToHsl('#34d9a0').h)).toBeLessThan(6);
  });
});
