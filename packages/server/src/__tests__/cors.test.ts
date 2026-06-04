import { describe, it, expect } from 'vitest';
import { matchOrigin, expandOriginPatterns, isWellFormedOrigin } from '../publicApi/index.js';

describe('publicApi/cors — expandOriginPatterns', () => {
  it('expands localhost to http + https, default-port and any-port', () => {
    expect(expandOriginPatterns(['localhost'])).toEqual([
      'http://localhost',
      'http://localhost:*',
      'https://localhost',
      'https://localhost:*',
    ]);
  });

  it('passes through * and explicit origins, trims, drops empties', () => {
    expect(expandOriginPatterns([' * ', 'https://a.com', '', '  '])).toEqual([
      '*',
      'https://a.com',
    ]);
  });
});

describe('publicApi/cors — wildcard-all', () => {
  it('* returns literal * with wildcard:true regardless of origin', () => {
    expect(matchOrigin(['*'], 'https://anything.example')).toEqual({
      allowed: true,
      headerValue: '*',
      wildcard: true,
    });
  });

  it('* with no Origin header still returns the policy value *', () => {
    expect(matchOrigin(['*'], undefined).headerValue).toBe('*');
  });

  it('a * anywhere in a longer list opens everything', () => {
    expect(matchOrigin(['https://a.com', '*'], 'https://whatever.io').headerValue).toBe('*');
  });

  it('bare "localhost" alone does NOT imply wildcard-all', () => {
    expect(matchOrigin(['localhost'], 'https://evil.com').allowed).toBe(false);
  });
});

describe('publicApi/cors — empty / no-match', () => {
  it('empty or null list denies', () => {
    expect(matchOrigin([], 'https://a.com')).toEqual({ allowed: false, headerValue: null, wildcard: false });
    expect(matchOrigin(null, 'https://a.com').allowed).toBe(false);
    expect(matchOrigin(undefined, 'https://a.com').allowed).toBe(false);
  });

  it('a non-wildcard list with no Origin header denies', () => {
    expect(matchOrigin(['https://a.com'], undefined).allowed).toBe(false);
    expect(matchOrigin(['https://a.com'], null).allowed).toBe(false);
  });

  it('a non-matching origin denies', () => {
    expect(matchOrigin(['https://a.com'], 'https://b.com').allowed).toBe(false);
  });
});

describe('publicApi/cors — exact origin', () => {
  it('reflects an exact origin with wildcard:false', () => {
    expect(matchOrigin(['https://app.example.com'], 'https://app.example.com')).toEqual({
      allowed: true,
      headerValue: 'https://app.example.com',
      wildcard: false,
    });
  });

  it('treats dots as literal (no accidental regex wildcard)', () => {
    expect(matchOrigin(['https://app.example.com'], 'https://appxexample.com').allowed).toBe(false);
  });

  it('does not match on a different scheme', () => {
    expect(matchOrigin(['https://app.example.com'], 'http://app.example.com').allowed).toBe(false);
  });
});

describe('publicApi/cors — localhost shorthand', () => {
  it('matches any http/https port (and no port)', () => {
    expect(matchOrigin(['localhost'], 'http://localhost:3000').allowed).toBe(true);
    expect(matchOrigin(['localhost'], 'https://localhost:8443').allowed).toBe(true);
    expect(matchOrigin(['localhost'], 'http://localhost').allowed).toBe(true);
  });

  it('does NOT match a lookalike host', () => {
    expect(matchOrigin(['localhost'], 'http://localhost.evil.com').allowed).toBe(false);
    expect(matchOrigin(['localhost'], 'http://notlocalhost:3000').allowed).toBe(false);
    expect(matchOrigin(['localhost'], 'http://evil.localhost.com').allowed).toBe(false);
  });
});

describe('publicApi/cors — port wildcard', () => {
  it('http://localhost:* matches any port but only the http scheme', () => {
    expect(matchOrigin(['http://localhost:*'], 'http://localhost:5173').allowed).toBe(true);
    expect(matchOrigin(['http://localhost:*'], 'http://localhost:1').allowed).toBe(true);
    expect(matchOrigin(['http://localhost:*'], 'https://localhost:5173').allowed).toBe(false);
  });
});

describe('publicApi/cors — subdomain wildcard', () => {
  const pat = ['https://*.example.com'];

  it('matches a subdomain', () => {
    expect(matchOrigin(pat, 'https://app.example.com').allowed).toBe(true);
    expect(matchOrigin(pat, 'https://a.b.example.com').allowed).toBe(true);
  });

  it('does not match the apex (no subdomain)', () => {
    expect(matchOrigin(pat, 'https://example.com').allowed).toBe(false);
  });

  it('is anchored: a trailing host cannot be appended', () => {
    expect(matchOrigin(pat, 'https://app.example.com.evil.com').allowed).toBe(false);
  });

  it('the wildcard cannot cross a slash (no path smuggling)', () => {
    expect(matchOrigin(pat, 'https://evil.com/.example.com').allowed).toBe(false);
  });
});

describe('publicApi/cors — scheme wildcard', () => {
  it('*://localhost:* matches any scheme and port', () => {
    expect(matchOrigin(['*://localhost:*'], 'http://localhost:3000').allowed).toBe(true);
    expect(matchOrigin(['*://localhost:*'], 'https://localhost:3000').allowed).toBe(true);
  });
});

describe('publicApi/cors — multiple patterns', () => {
  it('matches if ANY pattern matches', () => {
    const pats = ['https://prod.example.com', 'http://localhost:*'];
    expect(matchOrigin(pats, 'http://localhost:4000').allowed).toBe(true);
    expect(matchOrigin(pats, 'https://prod.example.com').allowed).toBe(true);
    expect(matchOrigin(pats, 'https://staging.example.com').allowed).toBe(false);
  });
});

describe('publicApi/cors — isWellFormedOrigin', () => {
  for (const ok of ['https://app.example.com', 'http://localhost:3000', 'http://127.0.0.1:5173', 'https://a.b.example.com']) {
    it(`accepts ${ok}`, () => expect(isWellFormedOrigin(ok)).toBe(true));
  }
  const bad: Array<[string, string]> = [
    ['CRLF + header', 'https://evil.com\r\nSet-Cookie: x=1'],
    ['trailing newline', 'https://app.example.com\n'],
    ['bare CR', 'https://app.example.com\r'],
    ['tab', 'https://app\t.example.com'],
    ['embedded space', 'https://app .example.com'],
    ['has path', 'https://app.example.com/evil'],
    ['has query', 'https://app.example.com?q=1'],
    ['null origin', 'null'],
    ['js scheme', 'javascript:alert(1)'],
    ['ipv6 literal', 'http://[::1]:3000'],
    ['oversized', 'https://' + 'a'.repeat(3000) + '.com'],
  ];
  for (const [label, value] of bad) {
    it(`rejects ${label}`, () => expect(isWellFormedOrigin(value)).toBe(false));
  }
});

describe('publicApi/cors — header-injection guard (regression)', () => {
  // The reflect path echoes the Origin into Access-Control-Allow-Origin. A
  // crafted Origin must never be reflected, even when it would otherwise match
  // a pattern's shape. Node's header validation is a backstop, not the gate.
  it('does not match a CRLF-bearing origin against a subdomain wildcard', () => {
    const d = matchOrigin(['https://*.example.com'], 'https://evil\r\nSet-Cookie: x.example.com');
    expect(d.allowed).toBe(false);
    expect(d.headerValue).toBe(null);
  });

  it('does not match an origin with a trailing newline against an exact pattern', () => {
    // Without the control-char guard, regex `$` (no `m` flag) matches before a
    // final newline and the raw value (with the newline) would be reflected.
    expect(matchOrigin(['https://app.example.com'], 'https://app.example.com\n').allowed).toBe(false);
  });

  it('does not match a control-char-bearing localhost origin', () => {
    expect(matchOrigin(['http://localhost:*'], 'http://localhost:3000\r\n').allowed).toBe(false);
  });
});

describe('publicApi/cors — localhost shorthand is case-insensitive', () => {
  it('LOCALHOST expands the same as localhost (no dead literal pattern)', () => {
    expect(expandOriginPatterns(['LOCALHOST'])).toEqual([
      'http://localhost',
      'http://localhost:*',
      'https://localhost',
      'https://localhost:*',
    ]);
  });

  it('a key stored with LOCALHOST still matches a real localhost origin', () => {
    expect(matchOrigin(['LOCALHOST'], 'http://localhost:3000').allowed).toBe(true);
  });
});

describe('publicApi/cors — credentials safety invariant', () => {
  it('decision never carries a credentials concept (Bearer auth, no cookies)', () => {
    const d = matchOrigin(['*'], 'https://x.com');
    // If a future change adds credentials handling, this guard forces a
    // deliberate decision about pairing it with Access-Control-Allow-Credentials.
    expect(Object.keys(d).sort()).toEqual(['allowed', 'headerValue', 'wildcard']);
  });
});
