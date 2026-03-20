import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../sanitize';

describe('sanitizeHtml', () => {
  // --- Allowed elements preserved ---

  describe('allowed elements', () => {
    it('preserves paragraph tags', () => {
      expect(sanitizeHtml('<p>Hello world</p>')).toBe('<p>Hello world</p>');
    });

    it('preserves links with href', () => {
      expect(sanitizeHtml('<a href="https://example.com">link</a>')).toBe(
        '<a href="https://example.com">link</a>',
      );
    });

    it('preserves images with src and alt', () => {
      const html = '<img src="https://example.com/photo.jpg" alt="A photo" />';
      const result = sanitizeHtml(html);
      expect(result).toContain('src="https://example.com/photo.jpg"');
      expect(result).toContain('alt="A photo"');
    });

    it('preserves heading tags h1-h6', () => {
      expect(sanitizeHtml('<h1>Title</h1>')).toBe('<h1>Title</h1>');
      expect(sanitizeHtml('<h3>Sub</h3>')).toBe('<h3>Sub</h3>');
      expect(sanitizeHtml('<h6>Small</h6>')).toBe('<h6>Small</h6>');
    });

    it('preserves lists', () => {
      const html = '<ul><li>One</li><li>Two</li></ul>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('preserves ordered lists', () => {
      const html = '<ol><li>First</li><li>Second</li></ol>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('preserves blockquote', () => {
      expect(sanitizeHtml('<blockquote>Quote</blockquote>')).toBe(
        '<blockquote>Quote</blockquote>',
      );
    });

    it('preserves code and pre', () => {
      expect(sanitizeHtml('<pre><code>const x = 1;</code></pre>')).toBe(
        '<pre><code>const x = 1;</code></pre>',
      );
    });

    it('preserves em, strong, br', () => {
      expect(sanitizeHtml('<em>italic</em>')).toBe('<em>italic</em>');
      expect(sanitizeHtml('<strong>bold</strong>')).toBe('<strong>bold</strong>');
      expect(sanitizeHtml('line<br>break')).toContain('<br>');
    });

    it('preserves tables', () => {
      const html = '<table><tr><th>Head</th></tr><tr><td>Cell</td></tr></table>';
      expect(sanitizeHtml(html)).toBe(html);
    });
  });

  // --- Dangerous elements stripped ---

  describe('dangerous elements', () => {
    it('strips script tags', () => {
      expect(sanitizeHtml('<script>alert(1)</script>')).toBe('alert(1)');
    });

    it('strips script tags with attributes', () => {
      expect(sanitizeHtml('<script type="text/javascript">alert(1)</script>')).toBe(
        'alert(1)',
      );
    });

    it('strips iframe tags', () => {
      expect(sanitizeHtml('<iframe src="https://evil.com"></iframe>')).toBe('');
    });

    it('strips object tags', () => {
      expect(sanitizeHtml('<object data="evil.swf"></object>')).toBe('');
    });

    it('strips embed tags', () => {
      expect(sanitizeHtml('<embed src="evil.swf">')).toBe('');
    });

    it('strips form elements', () => {
      expect(sanitizeHtml('<form action="/steal"><input type="text"></form>')).toBe('');
    });

    it('strips style tags', () => {
      expect(sanitizeHtml('<style>body { display: none; }</style>')).toBe(
        'body { display: none; }',
      );
    });

    it('strips svg tags', () => {
      expect(sanitizeHtml('<svg onload="alert(1)"><circle r="10"/></svg>')).toBe('');
    });

    it('strips HTML comments', () => {
      expect(sanitizeHtml('before<!-- comment -->after')).toBe('beforeafter');
    });
  });

  // --- Dangerous attributes stripped ---

  describe('dangerous attributes', () => {
    it('strips onclick', () => {
      const result = sanitizeHtml('<p onclick="alert(1)">text</p>');
      expect(result).not.toContain('onclick');
      expect(result).toContain('text');
    });

    it('strips onerror on img', () => {
      const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain('onerror');
    });

    it('strips onload', () => {
      const result = sanitizeHtml('<p onload="alert(1)">text</p>');
      expect(result).not.toContain('onload');
    });

    it('strips onmouseover', () => {
      const result = sanitizeHtml('<a href="https://ok.com" onmouseover="alert(1)">link</a>');
      expect(result).not.toContain('onmouseover');
      expect(result).toContain('href="https://ok.com"');
    });

    it('strips style attribute', () => {
      const result = sanitizeHtml('<p style="background: url(evil)">text</p>');
      expect(result).not.toContain('style');
    });
  });

  // --- Dangerous URLs ---

  describe('dangerous URLs', () => {
    it('strips javascript: in href', () => {
      const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('strips javascript: in src', () => {
      const result = sanitizeHtml('<img src="javascript:alert(1)">');
      expect(result).not.toContain('javascript:');
    });

    it('strips vbscript: URLs', () => {
      const result = sanitizeHtml('<a href="vbscript:alert(1)">click</a>');
      expect(result).not.toContain('vbscript:');
    });

    it('strips data: URLs with non-image MIME types', () => {
      const result = sanitizeHtml('<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>');
      expect(result).not.toContain('data:text/html');
    });

    it('allows data: URLs for images', () => {
      const result = sanitizeHtml(
        '<img src="data:image/png;base64,iVBORw0KGgo=" alt="pixel">',
      );
      expect(result).toContain('data:image/png;base64');
    });

    it('handles unicode obfuscation of javascript:', () => {
      // Some obfuscation attempts
      const result = sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>');
      // The raw entities get passed through; our URL parser catches the scheme
      expect(result).not.toContain('javascript:');
    });
  });

  // --- Preserves legitimate content ---

  describe('legitimate content preserved', () => {
    it('preserves markdown-style HTML', () => {
      const html =
        '<h1>Title</h1><p>A paragraph with <strong>bold</strong> and <em>italic</em>.</p><ul><li>Item</li></ul>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('preserves code blocks with angle brackets', () => {
      const html = '<pre><code>if (x &lt; 10) { return x &gt; 0; }</code></pre>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('preserves external image URLs', () => {
      const html = '<img src="https://cdn.example.com/photo.webp" alt="Photo">';
      const result = sanitizeHtml(html);
      expect(result).toContain('https://cdn.example.com/photo.webp');
    });

    it('preserves internal links', () => {
      const html = '<a href="https://hack.build/project/robot-arm">Robot Arm</a>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('preserves mailto links', () => {
      const html = '<a href="mailto:user@example.com">Email</a>';
      expect(sanitizeHtml(html)).toBe(html);
    });

    it('handles empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('handles plain text (no HTML)', () => {
      expect(sanitizeHtml('Just plain text')).toBe('Just plain text');
    });

    it('preserves text between stripped tags', () => {
      const html = '<div><p>Keep this</p></div>';
      const result = sanitizeHtml(html);
      expect(result).toContain('<p>Keep this</p>');
    });
  });

  // --- Real-world XSS payloads ---

  describe('real-world XSS payloads', () => {
    it('strips SVG onload payload', () => {
      const result = sanitizeHtml('<svg/onload=alert(1)>');
      expect(result).not.toContain('alert');
    });

    it('strips IMG onerror payload', () => {
      const result = sanitizeHtml('<img src=x onerror=alert(1)>');
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('strips nested script attempts', () => {
      const result = sanitizeHtml('<scr<script>ipt>alert(1)</script>');
      expect(result).not.toContain('<script>');
    });

    it('strips event handlers with various quotes', () => {
      const result = sanitizeHtml(`<a href="#" onclick='alert(1)'>x</a>`);
      expect(result).not.toContain('onclick');
    });

    it('handles Mastodon-style HTML (real world)', () => {
      const mastodonHtml =
        '<p>Hello <span class="h-card"><a href="https://mastodon.social/@alice" class="u-url mention">@<span>alice</span></a></span> check this out!</p>';
      const result = sanitizeHtml(mastodonHtml);
      expect(result).toContain('<p>');
      expect(result).toContain('<a href="https://mastodon.social/@alice"');
      expect(result).toContain('<span');
      expect(result).toContain('alice');
    });
  });
});
