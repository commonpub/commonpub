import { describe, it, expect } from 'vitest';
import { sanitizeBlockHtml } from '../../../layers/base/composables/useSanitize';

describe('sanitizeBlockHtml (client-side defense-in-depth)', () => {
  describe('strips dangerous elements', () => {
    it('strips script tags', () => {
      expect(sanitizeBlockHtml('<script>alert(1)</script>')).toBe('alert(1)');
    });

    it('strips iframe tags', () => {
      expect(sanitizeBlockHtml('<iframe src="https://evil.com"></iframe>')).toBe('');
    });

    it('strips object/embed tags', () => {
      expect(sanitizeBlockHtml('<object data="evil.swf"></object>')).toBe('');
      expect(sanitizeBlockHtml('<embed src="evil.swf">')).toBe('');
    });

    it('strips form elements', () => {
      expect(sanitizeBlockHtml('<form action="/steal"><input type="text"></form>')).toBe('');
    });

    it('strips style tags', () => {
      expect(sanitizeBlockHtml('<style>body{display:none}</style>')).toBe('body{display:none}');
    });

    it('strips HTML comments', () => {
      expect(sanitizeBlockHtml('before<!-- comment -->after')).toBe('beforeafter');
    });
  });

  describe('strips dangerous attributes', () => {
    it('strips onclick', () => {
      const result = sanitizeBlockHtml('<p onclick="alert(1)">text</p>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('text');
    });

    it('strips onerror on img', () => {
      const result = sanitizeBlockHtml('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('strips style attribute', () => {
      const result = sanitizeBlockHtml('<p style="background:url(evil)">text</p>');
      expect(result).not.toContain('style');
    });
  });

  describe('strips dangerous URLs', () => {
    it('strips javascript: in href', () => {
      const result = sanitizeBlockHtml('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('strips vbscript: URLs', () => {
      const result = sanitizeBlockHtml('<a href="vbscript:alert(1)">click</a>');
      expect(result).not.toContain('vbscript:');
    });

    it('strips blob: URLs', () => {
      const result = sanitizeBlockHtml('<a href="blob:https://evil.com/guid">x</a>');
      expect(result).not.toContain('blob:');
    });

    it('allows data: image URIs', () => {
      const result = sanitizeBlockHtml('<img src="data:image/png;base64,abc" alt="x">');
      expect(result).toContain('data:image/png;base64,abc');
    });

    it('rejects data: non-image URIs', () => {
      const result = sanitizeBlockHtml('<img src="data:text/html;base64,abc">');
      expect(result).not.toContain('data:text/html');
    });
  });

  describe('preserves safe content', () => {
    it('preserves paragraph, heading, list, link, emphasis', () => {
      const html = '<h2>Title</h2><p>Text with <strong>bold</strong> and <a href="https://example.com">link</a>.</p><ul><li>item</li></ul>';
      expect(sanitizeBlockHtml(html)).toBe(html);
    });

    it('preserves code blocks', () => {
      const html = '<pre><code>const x = 1;</code></pre>';
      expect(sanitizeBlockHtml(html)).toBe(html);
    });

    it('preserves images with src and alt', () => {
      const result = sanitizeBlockHtml('<img src="https://cdn.example.com/photo.jpg" alt="Photo">');
      expect(result).toContain('src="https://cdn.example.com/photo.jpg"');
      expect(result).toContain('alt="Photo"');
    });

    it('preserves blockquote', () => {
      expect(sanitizeBlockHtml('<blockquote>Quote</blockquote>')).toBe('<blockquote>Quote</blockquote>');
    });

    it('handles empty input', () => {
      expect(sanitizeBlockHtml('')).toBe('');
    });

    it('handles non-string input', () => {
      expect(sanitizeBlockHtml(null as unknown as string)).toBe('');
      expect(sanitizeBlockHtml(undefined as unknown as string)).toBe('');
    });

    it('handles Mastodon-style HTML', () => {
      const html = '<p>Hello <span class="h-card"><a href="https://mastodon.social/@alice" class="u-url mention">@<span>alice</span></a></span>!</p>';
      const result = sanitizeBlockHtml(html);
      expect(result).toContain('<a href="https://mastodon.social/@alice"');
      expect(result).toContain('alice');
    });
  });

  describe('real-world XSS payloads', () => {
    it('strips IMG onerror payload', () => {
      const result = sanitizeBlockHtml('<img src=x onerror=alert(1)>');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('strips SVG onload payload', () => {
      const result = sanitizeBlockHtml('<svg/onload=alert(1)>');
      expect(result).not.toContain('alert');
    });

    it('handles case-insensitive JAVASCRIPT:', () => {
      const result = sanitizeBlockHtml('<a href="JaVaScRiPt:alert(1)">x</a>');
      expect(result).not.toContain('JaVaScRiPt:');
    });
  });
});
