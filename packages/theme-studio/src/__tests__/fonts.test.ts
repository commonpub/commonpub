import { describe, it, expect } from 'vitest';
import { googleHref, fontStack, fallbackFor, SINGLE_WEIGHT } from '../fonts.js';

describe('googleHref', () => {
  it('returns empty string for no families', () => {
    expect(googleHref([])).toBe('');
    expect(googleHref(['', ''])).toBe('');
  });

  it('only ever targets fonts.googleapis.com', () => {
    expect(googleHref(['Inter']).startsWith('https://fonts.googleapis.com/css2?')).toBe(true);
  });

  it('encodes spaces as + and requests two weights for variable families', () => {
    const href = googleHref(['Playfair Display']);
    expect(href).toContain('family=Playfair+Display:wght@400;700');
  });

  it('omits the weight axis for single-weight families', () => {
    expect(SINGLE_WEIGHT.has('Anton')).toBe(true);
    const href = googleHref(['Anton']);
    expect(href).toContain('family=Anton&');
    expect(href).not.toContain('Anton:wght');
  });

  it('de-duplicates families', () => {
    const href = googleHref(['Inter', 'Inter', 'Roboto']);
    expect((href.match(/family=/g) ?? []).length).toBe(2);
  });

  it('URL-encodes a tampered family so it cannot inject extra query params', () => {
    // A malicious entry trying to smuggle a second `family=` / `display=`.
    const href = googleHref(['Inter&family=Evil&display=block']);
    // Still exactly one real `family=` param (the encoded one); no raw &family/&display injected.
    expect((href.match(/&family=/g) ?? []).length).toBe(0);
    expect((href.match(/family=/g) ?? []).length).toBe(1);
    expect(href).not.toContain('family=Evil');
    expect(href).toContain('%26family%3DEvil'); // encoded, inert
    // The trailing display=swap we add is the only display param.
    expect((href.match(/display=/g) ?? []).length).toBe(1);
  });
});

describe('font stacks', () => {
  it('mono families fall back to monospace, serif to serif, else sans', () => {
    expect(fallbackFor('JetBrains Mono')).toContain('monospace');
    expect(fallbackFor('Fraunces')).toContain('serif');
    expect(fallbackFor('Inter')).toContain('sans-serif');
  });

  it('fontStack quotes the family and appends fallbacks', () => {
    expect(fontStack('Work Sans')).toBe("'Work Sans', system-ui, sans-serif");
  });
});
