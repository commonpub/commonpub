import { describe, it, expect } from 'vitest';
import { safeRemoteUrl } from '../federation/urlGuard.js';

// The federated-ingestion scheme guard: remote objects bypass local zod, so a
// hostile instance's javascript:/data: url must never reach a stored :href.
describe('safeRemoteUrl', () => {
  it('passes http(s) URLs through unchanged', () => {
    expect(safeRemoteUrl('https://example.com/x')).toBe('https://example.com/x');
    expect(safeRemoteUrl('http://example.com')).toBe('http://example.com');
    expect(safeRemoteUrl('HTTPS://Example.com')).toBe('HTTPS://Example.com');
    expect(safeRemoteUrl('  https://example.com  ')).toBe('  https://example.com  ');
  });

  it('rejects dangerous and non-http schemes → null', () => {
    for (const bad of [
      'javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'blob:x',
      'file:///etc/passwd', '//evil.com', '/relative', 'mailto:x@y.com', 'ftp://x',
    ]) {
      expect(safeRemoteUrl(bad), bad).toBeNull();
    }
  });

  it('rejects non-string input → null', () => {
    expect(safeRemoteUrl(null)).toBeNull();
    expect(safeRemoteUrl(undefined)).toBeNull();
    expect(safeRemoteUrl(42)).toBeNull();
    expect(safeRemoteUrl({ url: 'https://x' })).toBeNull();
  });
});
