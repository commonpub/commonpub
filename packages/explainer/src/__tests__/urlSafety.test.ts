/**
 * Guards the URL-scheme gate, and — the part that matters — guards that EVERY
 * sanitizer in this package actually routes through it.
 *
 * This package shipped two sanitizers with two different, both-wrong attempts at
 * the same job. Fixing one and testing one is how a package acquires a third broken
 * copy, so the last describe block scans the package for sanitizers and asserts each
 * one refuses the vectors, rather than testing the one that was noticed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { isSafeUrl, decodeForSchemeCheck } from '../urlSafety';
import { sanitizeRichHtml } from '../render/sectionRenderer';

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const NUL = String.fromCharCode(0);

/** Every encoding that beat a `.replace(/javascript:/gi,'')` denylist. */
const EXECUTABLE = [
  ['plain', 'javascript:alert(1)'],
  ['uppercase', 'JAVASCRIPT:alert(1)'],
  ['mixed case', 'JaVaScRiPt:alert(1)'],
  ['nested reassembly', 'javasjavascript:cript:alert(1)'],
  ['nested reassembly 2', 'javajavascript:script:alert(1)'],
  ['leading space', '   javascript:alert(1)'],
  ['tab in scheme', `java${TAB}script:alert(1)`],
  ['newline in scheme', `java${LF}script:alert(1)`],
  ['CR in scheme', `java${CR}script:alert(1)`],
  ['NUL in scheme', `java${NUL}script:alert(1)`],
  ['decimal entity colon', 'javascript&#58;alert(1)'],
  ['hex entity colon', 'javascript&#x3a;alert(1)'],
  ['zero-padded decimal', 'javascript&#0000058;alert(1)'],
  ['zero-padded hex', 'javascript&#x0003a;alert(1)'],
  ['decimal, no semicolon', 'javascript&#58alert(1)'],
  ['named colon entity', 'javascript&colon;alert(1)'],
  ['named Tab entity (capital T is the real one)', 'java&Tab;script:alert(1)'],
  ['named NewLine entity', 'java&NewLine;script:alert(1)'],
  ['vbscript', 'vbscript:msgbox(1)'],
  ['data text/html', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
  ['data image/svg', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
  ['blob', 'blob:https://evil.test/abc'],
  ['file', 'file:///etc/passwd'],
] as const;

/** URLs an author legitimately writes; refusing these is also a bug. */
const SAFE = [
  ['absolute https', 'https://example.com/a?b=1#c'],
  ['absolute http', 'http://example.com/a'],
  ['root-relative', '/u/someone/project/thing'],
  ['relative', 'thing.html'],
  ['fragment', '#section-2'],
  ['query only', '?page=2'],
  ['mailto', 'mailto:hi@example.com'],
  ['protocol-relative', '//example.com/a'],
  ['empty', ''],
  ['path containing the word javascript', 'https://example.com/javascript-guide'],
  ['encoded colon in the PATH, not the scheme', 'https://example.com/a&#58;b'],
  ['uppercase host', 'HTTPS://EXAMPLE.COM/a'],
] as const;

describe('isSafeUrl', () => {
  it.each(EXECUTABLE)('refuses %s', (_label, url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it.each(SAFE)('allows %s', (_label, url) => {
    expect(isSafeUrl(url)).toBe(true);
  });
});

/**
 * Deliberately over-blocked. Measured against Chromium's HTML parser: for each of
 * these the browser resolves the href to `https:` (i.e. relative — NOT executable),
 * because HTML named character references are case-SENSITIVE and, outside the legacy
 * set, require the semicolon. `decodeForSchemeCheck` is case-insensitive and treats
 * the semicolon as optional, so it decodes them anyway and the URL is refused.
 *
 * That is the correct trade for a security gate: the cost of over-blocking is one
 * dropped href in a contrived URL, the cost of under-blocking is XSS. Recorded as a
 * separate group so nobody reads these as real bypasses — they are not, and calling
 * them "executable" would be false.
 */
const OVER_BLOCKED = [
  ['&COLON; — uppercase is not the colon entity', 'javascript&COLON;alert(1)'],
  ['&Colon; — U+2237 PROPORTION, not a colon', 'javascript&Colon;alert(1)'],
  ['&colon without semicolon', 'javascript&colonalert(1)'],
  ['&tab; — lowercase is not an entity', 'java&tab;script:alert(1)'],
  ['&newline; — lowercase is not an entity', 'java&newline;script:alert(1)'],
] as const;

describe('deliberately refused although a browser would not execute them', () => {
  it.each(OVER_BLOCKED)('refuses %s', (_label, url) => {
    expect(isSafeUrl(url)).toBe(false);
  });
});

describe('decodeForSchemeCheck', () => {
  it('decodes the entity forms a browser decodes', () => {
    expect(decodeForSchemeCheck('a&#58;b')).toBe('a:b');
    expect(decodeForSchemeCheck('a&#x3a;b')).toBe('a:b');
    expect(decodeForSchemeCheck('a&colon;b')).toBe('a:b');
  });

  it('strips the characters a browser discards while reading a scheme', () => {
    expect(decodeForSchemeCheck(`ja${TAB}va${LF}scr${CR}ipt:`)).toBe('javascript:');
  });

  it('does NOT decode a double-encoded entity into a colon', () => {
    // `&amp;#58;` renders as the literal text `&#58;`, not a colon, so treating it
    // as one would refuse a legitimate relative URL.
    expect(decodeForSchemeCheck('javascript&amp;#58;alert(1)')).not.toContain(':');
  });
});

/**
 * The class guard. Find every sanitizer in the package and assert each one refuses
 * an executable URL — so a third copy added later fails here instead of shipping.
 */
function findSanitizers(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/^(node_modules|dist|__tests__)$/.test(entry.name)) continue;
      findSanitizers(p, out);
    } else if (/\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
      const src = readFileSync(p, 'utf8');
      if (/export function sanitize[A-Za-z]*Html\s*\(/.test(src)) out.push(p);
    }
  }
  return out;
}

const PKG_ROOT = resolve(__dirname, '..', '..');
const sanitizerFiles = findSanitizers(PKG_ROOT);

describe('every sanitizer in this package routes through the shared gate', () => {
  it('found the sanitizers it expects', () => {
    const rel = sanitizerFiles.map((f) => f.slice(PKG_ROOT.length + 1)).sort();
    expect(rel).toEqual(['src/render/sectionRenderer.ts', 'vue/utils/sanitize.ts']);
  });

  it.each(sanitizerFiles.map((f) => f.slice(PKG_ROOT.length + 1)))(
    '%s imports isSafeUrl rather than rolling its own scheme check',
    (rel) => {
      const src = readFileSync(join(PKG_ROOT, rel), 'utf8');
      expect(src).toMatch(/import \{[^}]*isSafeUrl[^}]*\} from/);
      // and does not reintroduce the denylist that failed
      expect(src).not.toMatch(/replace\([^)]*javascript\\?s\*:/i);
    },
  );
});

describe('sectionRenderer refuses executable URLs end to end', () => {
  it.each(EXECUTABLE)('neutralises %s in an href', (_label, url) => {
    const out = sanitizeRichHtml(`<a href="${url}">click</a>`);
    const m = /<a\b[^>]*\shref\s*=\s*"([^"]*)"/i.exec(out);
    const href = m ? m[1]! : '';
    expect(isSafeUrl(href)).toBe(true);
  });

  it('leaves a legitimate href alone', () => {
    expect(sanitizeRichHtml('<a href="https://example.com/x">y</a>'))
      .toContain('href="https://example.com/x"');
  });

  /**
   * The scheme check must run per-TAG, not over the whole document.
   *
   * An earlier version (both the original denylist and my first replacement for it)
   * ran the URL regex across the entire string, so `href=` appearing in ordinary
   * prose or inside a code sample was rewritten too — a paragraph explaining
   * `href="javascript:x"` came out as `href="#"`. Text content is not markup and
   * must never be touched.
   */
  it.each([
    ['prose mentioning a javascript href', '<p>Set href=javascript:void(0) to disable it.</p>'],
    ['prose mentioning a data href', '<p>Use href=data:text/html for inline docs.</p>'],
    ['a code sample showing an anchor', '<pre><code>&lt;a href="javascript:x"&gt;</code></pre>'],
  ])('does not rewrite %s', (_label, input) => {
    expect(sanitizeRichHtml(input)).toBe(input);
  });
});
