import { describe, it, expect } from 'vitest';
import { safeHref, isHttpUrl } from '../safeUrl';

describe('safeHref', () => {
  it('passes http(s) URLs through', () => {
    expect(safeHref('https://example.com/x')).toBe('https://example.com/x');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('HTTPS://Example.com')).toBe('HTTPS://Example.com');
  });
  it('collapses dangerous / non-http schemes to #', () => {
    for (const bad of [
      'javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'blob:x', 'file:///etc/passwd',
      '//evil.com', 'mailto:x@y.com', 'tel:+1', '/relative', '#anchor', '', null, undefined,
    ]) {
      expect(safeHref(bad), String(bad)).toBe('#');
    }
  });
  it('isHttpUrl agrees', () => {
    expect(isHttpUrl('https://x.com')).toBe(true);
    expect(isHttpUrl('javascript:x')).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
  });
});
