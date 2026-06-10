import { describe, it, expect } from 'vitest';
import { sanitizeRichHtml, sanitizeBlockHtml } from '../useSanitize';

describe('sanitizeRichHtml — permissive but script-free', () => {
  it('preserves layout tags and inline styles (the whole point of HTML mode)', () => {
    const html = '<div style="display:flex;gap:14px;"><section style="color:#059669;"><h2>Hi</h2><p>Body</p></section></div>';
    const out = sanitizeRichHtml(html);
    expect(out).toMatch(/<div style="display:flex;gap:14px;?">/);
    expect(out).toMatch(/<section style="color:#059669;?">/);
    expect(out).toContain('<h2>Hi</h2>');
  });

  it('preserves SVG with original-case names and presentation attrs', () => {
    const svg = '<svg viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7"/><linearGradient><stop offset="0" stop-color="#fff"/></linearGradient></svg>';
    const out = sanitizeRichHtml(svg);
    expect(out).toContain('viewBox="0 0 24 24"'); // case preserved
    expect(out).toContain('<linearGradient>');     // camelCase tag preserved
    expect(out).toContain('<path d="M5 13l4 4L19 7"');
  });

  it('drops <script> entirely, contents and all', () => {
    const out = sanitizeRichHtml('<div>ok</div><script>alert(1)</script>');
    expect(out).toContain('<div>ok</div>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert(1)'); // body removed too, not left as text
  });

  it('strips event-handler attributes', () => {
    const out = sanitizeRichHtml('<div onclick="evil()" onmouseover="x()" style="color:red">hi</div>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/onmouseover/i);
    expect(out).toContain('style="color:red"');
  });

  it('rejects javascript: URLs on a/img', () => {
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">x</a><img src="javascript:alert(2)">');
    expect(out).not.toContain('javascript:');
  });

  it('drops <iframe>, <object>, <embed>, <style>, <form>', () => {
    const out = sanitizeRichHtml('<iframe src="//evil"></iframe><object></object><embed><style>body{display:none}</style><form></form><div>safe</div>');
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/<object/i);
    expect(out).not.toMatch(/<embed/i);
    expect(out).not.toMatch(/<style/i);
    expect(out).not.toMatch(/<form/i);
    expect(out).toContain('<div>safe</div>');
  });

  it('scrubs dangerous CSS from the style attribute (url/expression/javascript)', () => {
    const out = sanitizeRichHtml('<div style="color:red;background:url(http://evil/track.png);width:10px">x</div>');
    expect(out).toContain('color:red');
    expect(out).toContain('width:10px');
    expect(out).not.toMatch(/url\(/i); // the background:url() declaration is removed
  });

  it('removes an expression()/behavior style declaration', () => {
    const out = sanitizeRichHtml('<div style="x:expression(alert(1));color:blue">x</div>');
    expect(out).not.toMatch(/expression/i);
    expect(out).toContain('color:blue');
  });

  it('escapes attribute values so they cannot break out', () => {
    const out = sanitizeRichHtml('<div title="&quot;&gt;<script>">x</div>');
    expect(out).not.toContain('<script>');
  });

  it('returns empty for falsy input', () => {
    expect(sanitizeRichHtml('')).toBe('');
    // @ts-expect-error testing runtime guard
    expect(sanitizeRichHtml(null)).toBe('');
  });
});

describe('sanitizeBlockHtml — strict allowlist still strips div/style (markdown mode)', () => {
  it('strips div and style (regression: markdown mode stays strict)', () => {
    const out = sanitizeBlockHtml('<div style="color:red"><p>kept</p></div>');
    expect(out).not.toContain('<div');
    expect(out).not.toContain('style=');
    expect(out).toContain('<p>kept</p>');
  });
});
