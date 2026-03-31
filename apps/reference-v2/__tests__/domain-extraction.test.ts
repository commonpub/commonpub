import { describe, it, expect } from 'vitest';

// Extracted from server/routes/inbox.ts for testability
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname) return parsed.hostname;
  } catch {
    // fall through to regex
  }
  return url.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
}

describe('extractDomain', () => {
  it('extracts hostname from https URL', () => {
    expect(extractDomain('https://example.com')).toBe('example.com');
  });

  it('strips trailing slash', () => {
    expect(extractDomain('https://example.com/')).toBe('example.com');
  });

  it('strips port', () => {
    expect(extractDomain('https://example.com:443')).toBe('example.com');
  });

  it('strips path', () => {
    expect(extractDomain('https://example.com/api/inbox')).toBe('example.com');
  });

  it('handles http scheme', () => {
    expect(extractDomain('http://localhost:3000')).toBe('localhost');
  });

  it('handles bare domain fallback', () => {
    expect(extractDomain('example.com')).toBe('example.com');
  });

  it('handles bare domain with port via fallback regex', () => {
    const result = extractDomain('example.com:3000');
    expect(result).toBe('example.com');
  });
});
