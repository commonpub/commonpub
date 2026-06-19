import { describe, it, expect } from 'vitest';
import { sanitizeBlockHtml } from '../utils.js';

describe('sanitizeBlockHtml', () => {
  it('removes <script> tags and their contents', () => {
    const out = sanitizeBlockHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('hi');
  });

  it('removes <style> tags and their contents', () => {
    const out = sanitizeBlockHtml('<style>body{display:none}</style><p>ok</p>');
    expect(out).not.toContain('<style');
    expect(out).not.toContain('display:none');
    expect(out).toContain('ok');
  });

  it('strips on* event-handler attributes', () => {
    const out = sanitizeBlockHtml('<a href="https://example.com" onclick="steal()">x</a>');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out).not.toContain('steal()');
  });

  it('removes onerror handlers on injected elements', () => {
    const out = sanitizeBlockHtml('<img src=x onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out).not.toContain('alert(1)');
  });

  it('neutralizes javascript: hrefs', () => {
    const out = sanitizeBlockHtml('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
    // The text content survives even though the dangerous href is dropped.
    expect(out).toContain('click');
  });

  it('strips iframe/object/embed elements', () => {
    const out = sanitizeBlockHtml(
      '<iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y">',
    );
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out.toLowerCase()).not.toContain('<object');
    expect(out.toLowerCase()).not.toContain('<embed');
  });

  it('preserves safe inline formatting', () => {
    const out = sanitizeBlockHtml('<strong>bold</strong> and <em>italic</em>');
    expect(out).toContain('<strong>');
    expect(out).toContain('bold');
    expect(out).toContain('<em>');
    expect(out).toContain('italic');
  });

  it('preserves safe https anchors', () => {
    const out = sanitizeBlockHtml('<a href="https://example.com">link</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('link');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeBlockHtml('')).toBe('');
    // @ts-expect-error testing runtime guard against bad input
    expect(sanitizeBlockHtml(null)).toBe('');
  });
});
