import { describe, expect, it } from 'vitest';

import { httpUrl, optionalUrl } from '../url.js';

/**
 * This helper is a deliberate copy of the one in
 * `packages/schema/src/validators/_shared.ts` rather than an import of it
 * (section 14.4), so it carries its own proof that it rejects the same schemes.
 * A URL that reaches an `:href` is a stored-XSS payload the moment the scheme is
 * not http(s), and zod's `.url()` alone accepts every one of these.
 */
describe('httpUrl', () => {
  const dangerous = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'blob:https://example.com/1234',
    'file:///etc/passwd',
  ];

  it('rejects every non-http(s) scheme', () => {
    for (const url of dangerous) {
      expect(httpUrl(512).safeParse(url).success, url).toBe(false);
    }
  });

  it('accepts http and https', () => {
    expect(httpUrl(512).safeParse('https://example.com/a').success).toBe(true);
    expect(httpUrl(512).safeParse('http://example.com').success).toBe(true);
    expect(httpUrl().safeParse('https://example.com').success).toBe(true);
  });

  it('enforces the maximum length', () => {
    const long = `https://example.com/${'a'.repeat(600)}`;
    expect(httpUrl(512).safeParse(long).success).toBe(false);
    expect(httpUrl().safeParse(long).success).toBe(true);
  });

  it('rejects a value that is not a URL at all', () => {
    expect(httpUrl(512).safeParse('not a url').success).toBe(false);
    expect(httpUrl(512).safeParse('').success).toBe(false);
  });
});

describe('optionalUrl', () => {
  it('treats an empty or whitespace string as absent', () => {
    expect(optionalUrl(512).parse('')).toBeUndefined();
    expect(optionalUrl(512).parse('   ')).toBeUndefined();
    expect(optionalUrl(512).parse(undefined)).toBeUndefined();
  });

  it('still rejects a dangerous scheme', () => {
    expect(optionalUrl(512).safeParse('javascript:alert(1)').success).toBe(false);
  });

  it('passes a good URL through unchanged', () => {
    expect(optionalUrl(512).parse('https://example.com/x')).toBe('https://example.com/x');
  });
});
