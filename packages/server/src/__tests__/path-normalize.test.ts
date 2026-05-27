/**
 * pathNormalize — full Vitest coverage per docs/plans/layout-and-pages.md §6.3.
 *
 * Pure function — no DB, no Nuxt, just I/O assertions.
 */
import { describe, it, expect } from 'vitest';
import { pathNormalize, RESERVED_PREFIXES } from '../layout/path-normalize.js';

describe('pathNormalize — happy path', () => {
  it.each([
    ['/about',        '/about'],
    ['/about/',       '/about'],
    ['about',         '/about'],
    ['/About',        '/about'],
    ['/ABOUT',        '/about'],
    ['//about',       '/about'],
    ['//about//',     '/about'],
    ['/a/b/c',        '/a/b/c'],
    ['a/b/c',         '/a/b/c'],
    ['//a//b//c//',   '/a/b/c'],
    ['/a-b',          '/a-b'],
    ['/a_b',          '/a_b'],
    ['/a1b2',         '/a1b2'],
    [' /about ',      '/about'],
    ['/a/b-c_d',      '/a/b-c_d'],
  ])('normalises %s → %s', (input, expected) => {
    const r = pathNormalize(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(expected);
  });
});

describe('pathNormalize — rejections', () => {
  it.each([
    ['',              'empty'],
    [' ',             'empty'],
    ['  \t\n  ',      'empty'],
    [null,            'empty'],
    [undefined,       'empty'],
    [42,              'empty'],
    [{},              'empty'],

    ['/about?ref=x',  'has-query'],
    ['/about?x',      'has-query'],
    ['?x',            'has-query'],

    ['/about#anchor', 'has-fragment'],
    ['#anchor',       'has-fragment'],

    ['/.',            'has-dot-segment'],
    ['/..',           'has-dot-segment'],
    ['/a/./b',        'has-dot-segment'],
    ['/a/../b',       'has-dot-segment'],

    ['/',             'reserved-prefix'],
    ['//',            'reserved-prefix'],
    ['/api',          'reserved-prefix'],
    ['/api/foo',      'reserved-prefix'],
    ['/API/foo',      'reserved-prefix'],  // case-folded then matched
    ['/_nuxt',        'reserved-prefix'],
    ['/_nuxt/abc',    'reserved-prefix'],
    ['/__nuxt',       'reserved-prefix'],
    ['/.well-known',  'reserved-prefix'],
    ['/.well-known/security.txt', 'reserved-prefix'],

    ['/about page',   'invalid-char'],  // space
    ['/about+test',   'invalid-char'],
    ['/cafe',         'ok'],  // baseline good — confirms acceptance
    ['/café',         'invalid-char'],  // non-ASCII
    ['/foo.html',     'invalid-char'],  // file extensions reserved
    ['/$money',       'invalid-char'],
  ])('rejects %s as %s', (input, reason) => {
    const r = pathNormalize(input);
    if (reason === 'ok') {
      expect(r.ok).toBe(true);
    } else {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe(reason);
    }
  });
});

describe('pathNormalize — reserved-prefix list', () => {
  it('every entry in RESERVED_PREFIXES rejects', () => {
    for (const prefix of RESERVED_PREFIXES) {
      const exact = pathNormalize(prefix);
      expect(exact.ok, `bare prefix ${prefix} should reject`).toBe(false);

      const child = pathNormalize(prefix + '/child');
      expect(child.ok, `${prefix}/child should reject`).toBe(false);
    }
  });

  it('case-insensitive against the reserved list (after lowercase)', () => {
    expect(pathNormalize('/API').ok).toBe(false);
    expect(pathNormalize('/Api/foo').ok).toBe(false);
    expect(pathNormalize('/_NUXT/abc').ok).toBe(false);
  });
});

describe('pathNormalize — invariants', () => {
  it('output is always lowercase', () => {
    const r = pathNormalize('/MixedCase/Path');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(r.path.toLowerCase());
  });

  it('output always starts with single slash, no trailing slash', () => {
    for (const input of ['about', '/about/', '//about///', 'about/page']) {
      const r = pathNormalize(input);
      if (r.ok) {
        expect(r.path.startsWith('/')).toBe(true);
        expect(r.path.startsWith('//')).toBe(false);
        if (r.path.length > 1) expect(r.path.endsWith('/')).toBe(false);
      }
    }
  });

  it('idempotent — normalising the output of normalise yields the same value', () => {
    for (const input of ['about', '/About/', '//a//b//']) {
      const first = pathNormalize(input);
      expect(first.ok).toBe(true);
      if (first.ok) {
        const second = pathNormalize(first.path);
        expect(second.ok).toBe(true);
        if (second.ok) expect(second.path).toBe(first.path);
      }
    }
  });
});
