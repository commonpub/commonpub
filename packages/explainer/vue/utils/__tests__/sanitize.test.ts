/**
 * Guards the sanitizer behind every `v-html` in `@commonpub/explainer/vue`.
 *
 * There are ten of them, and this function is the only barrier at render time:
 * SectionRenderer (body, bridge), ConclusionRenderer (body), BlockRenderer,
 * TextBlock, CalloutBlock, QuoteBlock, and the toggle and clickable-cards module
 * viewers.
 *
 * WHY THE URL CASES ARE THE POINT.
 * The original implementation neutralised dangerous URLs with
 * `.replace(/javascript\s*:/gi, '')`. A single-pass string replace cannot do
 * this job, and an audit found eight live bypasses:
 *
 *   javasjavascript:cript:  the replace removes the INNER occurrence and the
 *                           two halves close up into `javascript:`
 *   java<TAB>script:        the URL parser discards the tab; the regex does not
 *   java<LF>script:         same
 *   javascript&#58;         the HTML parser decodes the entity AFTER the regex ran
 *   javascript&#x3a;        same, hex
 *   data:text/html;base64,  never handled at all
 *   vbscript:               never handled at all
 *   <img src=…>             src was allow-listed but never scheme-checked
 *
 * `section.module` is not sanitised on write (`sanitizeExplainerDocument` in
 * `@commonpub/server` enumerates fields by hand and does not reach it) and
 * `createContentSchema` types `content` as `z.unknown()`, so for module content
 * this function is the ONLY barrier, not a second one. Hence: default-deny on the
 * scheme, after decoding, rather than denylisting known-bad strings.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../sanitize';

/** Resolve what a browser would actually navigate to, without a DOM. */
function hrefOf(html: string): string | null {
  const m = /<a\b[^>]*\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(html);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}
function srcOf(html: string): string | null {
  const m = /<img\b[^>]*\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(html);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);

describe('sanitizeHtml — executable URL schemes', () => {
  const VECTORS: Array<[string, string]> = [
    ['nested reassembly', '<a href="javasjavascript:cript:alert(1)">x</a>'],
    ['tab inside the scheme', `<a href="java${TAB}script:alert(1)">x</a>`],
    ['newline inside the scheme', `<a href="java${LF}script:alert(1)">x</a>`],
    ['decimal-entity colon', '<a href="javascript&#58;alert(1)">x</a>'],
    ['hex-entity colon', '<a href="javascript&#x3a;alert(1)">x</a>'],
    ['entity colon, no semicolon', '<a href="javascript&#58alert(1)">x</a>'],
    ['uppercase scheme', '<a href="JAVASCRIPT:alert(1)">x</a>'],
    ['mixed case scheme', '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['leading whitespace', '<a href="   javascript:alert(1)">x</a>'],
    ['vbscript', '<a href="vbscript:msgbox(1)">x</a>'],
    ['data text/html', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'],
    ['blob', '<a href="blob:https://evil.test/abc">x</a>'],
    ['file', '<a href="file:///etc/passwd">x</a>'],
    ['single-quoted', "<a href='javascript:alert(1)'>x</a>"],
    ['unquoted', '<a href=javascript:alert(1)>x</a>'],
  ];

  it.each(VECTORS)('drops the href for %s', (_label, input) => {
    expect(hrefOf(sanitizeHtml(input))).toBeNull();
  });

  it('scheme-checks img src, not just href', () => {
    expect(srcOf(sanitizeHtml('<img src="javasjavascript:cript:alert(1)">'))).toBeNull();
    expect(srcOf(sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">'))).toBeNull();
  });

  it('leaves the element itself, so text is not swallowed with the attribute', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">click me</a>')).toContain('click me');
  });
});

describe('sanitizeHtml — legitimate URLs still work', () => {
  const KEEP: Array<[string, string]> = [
    ['absolute https', 'https://example.com/a?b=1#c'],
    ['absolute http', 'http://example.com/a'],
    ['root-relative', '/u/someone/project/thing'],
    ['relative', 'thing'],
    ['fragment', '#section-2'],
    ['query only', '?page=2'],
    ['mailto', 'mailto:hi@example.com'],
    ['protocol-relative', '//example.com/a'],
    ['url containing the word javascript', 'https://example.com/javascript-guide'],
    ['url with an encoded colon in the PATH', 'https://example.com/a&#58;b'],
  ];

  it.each(KEEP)('keeps %s', (_label, url) => {
    expect(hrefOf(sanitizeHtml(`<a href="${url}">x</a>`))).toBe(url);
  });

  it('keeps a normal image', () => {
    expect(srcOf(sanitizeHtml('<img src="/uploads/a.png" alt="a">'))).toBe('/uploads/a.png');
  });
});

describe('sanitizeHtml — the barriers that already worked', () => {
  it('removes script and style elements with their contents', () => {
    expect(sanitizeHtml('<script>alert(1)</script>')).toBe('');
    expect(sanitizeHtml('<p>a</p><style>body{display:none}</style>')).toBe('<p>a</p>');
  });

  it('removes inline event handlers in every quoting style', () => {
    for (const v of [
      '<a href="#" onclick="alert(1)">x</a>',
      "<a href='#' onclick='alert(1)'>x</a>",
      '<a href="#" onclick=alert(1)>x</a>',
      '<a href="#" ONMOUSEOVER="alert(1)">x</a>',
    ]) {
      expect(sanitizeHtml(v).toLowerCase()).not.toMatch(/\son\w+\s*=/);
    }
  });

  it('drops tags that are not on the allowlist but keeps their text', () => {
    expect(sanitizeHtml('<iframe src="//evil.test"></iframe>')).toBe('');
    expect(sanitizeHtml('<form action="//evil.test"><b>hi</b></form>')).toBe('<b>hi</b>');
  });

  it('drops attributes that are not on the allowlist', () => {
    const out = sanitizeHtml('<p style="position:fixed;inset:0" data-x="1">t</p>');
    expect(out).not.toContain('style=');
    expect(out).toContain('t');
  });

  it('keeps ordinary formatting untouched', () => {
    const good = '<p>Hello <strong>world</strong> and <em>others</em>.</p>';
    expect(sanitizeHtml(good)).toBe(good);
  });
});

// Positive control: if the import ever resolves to something inert, every
// assertion above would pass against an empty string or an identity function.
describe('the guard is testing a real sanitizer', () => {
  it('is a function that actually transforms input', () => {
    expect(typeof sanitizeHtml).toBe('function');
    expect(sanitizeHtml('<script>x</script>')).not.toBe('<script>x</script>');
    expect(sanitizeHtml('<p>kept</p>')).toBe('<p>kept</p>');
    expect(sanitizeHtml('')).toBe('');
  });
});
