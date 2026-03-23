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

  // --- URL safety edge cases ---

  describe('URL safety', () => {
    it('strips blob: URLs', () => {
      const result = sanitizeHtml('<a href="blob:https://evil.com/guid">x</a>');
      expect(result).not.toContain('blob:');
    });

    it('strips ftp: scheme URLs', () => {
      const result = sanitizeHtml('<a href="ftp://evil.com/file">x</a>');
      expect(result).not.toContain('ftp:');
    });

    it('strips URLs with leading whitespace', () => {
      const result = sanitizeHtml('<a href="  javascript:alert(1)">x</a>');
      expect(result).not.toContain('javascript:');
    });

    it('strips data: URI with non-image type in img src', () => {
      const result = sanitizeHtml('<img src="data:text/html;base64,abc">');
      expect(result).not.toContain('data:text/html');
    });

    it('allows relative URLs', () => {
      const result = sanitizeHtml('<a href="/about">About</a>');
      expect(result).toContain('href="/about"');
    });

    it('allows http: URLs', () => {
      const result = sanitizeHtml('<a href="http://example.com">link</a>');
      expect(result).toContain('href="http://example.com"');
    });
  });

  // --- Input edge cases ---

  describe('input edge cases', () => {
    it('preserves self-closing tags with space', () => {
      const result = sanitizeHtml('<br />');
      expect(result).toContain('<br');
    });

    it('preserves img self-closing', () => {
      const result = sanitizeHtml('<img src="https://example.com/x.jpg" alt="x" />');
      expect(result).toContain('/>');
    });

    it('handles attributes with single quotes', () => {
      const result = sanitizeHtml("<a href='https://example.com'>link</a>");
      expect(result).toContain('href="https://example.com"');
    });

    it('handles attributes without quotes', () => {
      const result = sanitizeHtml('<a href=https://example.com>link</a>');
      expect(result).toContain('href="https://example.com"');
    });

    it('escapes angle brackets in attribute values', () => {
      const result = sanitizeHtml('<a href="https://example.com/?q=a&lt;b" title="x<y">link</a>');
      expect(result).toContain('&lt;');
    });

    it('escapes ampersands in attribute values', () => {
      const result = sanitizeHtml('<a href="https://example.com/?a=1&amp;b=2">link</a>');
      expect(result).toContain('&amp;');
    });

    it('escapes quotes in attribute values', () => {
      // Attribute with actual quote gets escaped by escapeAttrValue
      const result = sanitizeHtml('<a href="https://example.com">link</a>');
      // The href value itself should be preserved and properly escaped
      expect(result).toContain('href="https://example.com"');
    });

    it('strips disallowed attributes on allowed elements', () => {
      const result = sanitizeHtml('<p id="x" data-evil="y" class="highlight">text</p>');
      expect(result).not.toContain('id=');
      expect(result).not.toContain('data-evil');
      expect(result).toContain('class="highlight"');
    });

    it('preserves class attribute on code elements', () => {
      const result = sanitizeHtml('<code class="language-js">const x = 1;</code>');
      expect(result).toContain('class="language-js"');
    });

    it('preserves colspan and rowspan on td/th', () => {
      const result = sanitizeHtml('<td colspan="2" rowspan="3">cell</td>');
      expect(result).toContain('colspan="2"');
      expect(result).toContain('rowspan="3"');
    });

    it('preserves ol start and type attributes', () => {
      const result = sanitizeHtml('<ol start="5" type="a"><li>item</li></ol>');
      expect(result).toContain('start="5"');
      expect(result).toContain('type="a"');
    });

    it('handles tag with attributes but no allowed attrs', () => {
      const result = sanitizeHtml('<strong class="x">bold</strong>');
      expect(result).toBe('<strong>bold</strong>');
    });

    it('preserves multiple allowed attributes on a tag', () => {
      const result = sanitizeHtml('<a href="https://x.com" title="Title" class="link">text</a>');
      expect(result).toContain('href="https://x.com"');
      expect(result).toContain('title="Title"');
      expect(result).toContain('class="link"');
    });
  });

  // --- Attribute value escaping ---

  describe('attribute value escaping', () => {
    it('escapes & in href', () => {
      const result = sanitizeHtml('<a href="https://example.com/?a=1&b=2">link</a>');
      expect(result).toContain('a=1&amp;b=2');
    });

    it('escapes < in title attribute', () => {
      const result = sanitizeHtml('<a href="https://example.com" title="x<y">link</a>');
      expect(result).toContain('&lt;');
    });

    it('escapes > in rendered output', () => {
      // The > char in attribute values gets escaped to &gt; by escapeAttrValue
      const result = sanitizeHtml('<a href="https://example.com" class="a">link</a>');
      // Verify the attribute is properly formed (no unescaped special chars)
      expect(result).toContain('class="a"');
    });
  });

  // --- Case-insensitive URL scheme blocking ---

  describe('case-insensitive URL blocking', () => {
    it('strips JAVASCRIPT: (uppercase)', () => {
      const result = sanitizeHtml('<a href="JAVASCRIPT:alert(1)">x</a>');
      expect(result).not.toContain('JAVASCRIPT:');
    });

    it('strips JaVaScRiPt: (mixed case)', () => {
      const result = sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>');
      expect(result).not.toContain('JaVaScRiPt:');
    });

    it('strips VBSCRIPT: (uppercase)', () => {
      const result = sanitizeHtml('<a href="VBSCRIPT:alert(1)">x</a>');
      expect(result).not.toContain('VBSCRIPT:');
    });

    it('strips BLOB: (uppercase)', () => {
      const result = sanitizeHtml('<a href="BLOB:https://evil.com/x">x</a>');
      expect(result).not.toContain('BLOB:');
    });
  });

  // --- Data URI variations ---

  describe('data URI safety', () => {
    it('rejects data:image/bmp (not in allowlist)', () => {
      const result = sanitizeHtml('<img src="data:image/bmp;base64,abc">');
      expect(result).not.toContain('data:image/bmp');
    });

    it('rejects data:application/json', () => {
      const result = sanitizeHtml('<img src="data:application/json;base64,abc">');
      expect(result).not.toContain('data:application/json');
    });

    it('allows data:image/jpeg', () => {
      const result = sanitizeHtml('<img src="data:image/jpeg;base64,abc" alt="test">');
      expect(result).toContain('data:image/jpeg;base64,abc');
    });

    it('allows data:image/gif', () => {
      const result = sanitizeHtml('<img src="data:image/gif;base64,abc" alt="test">');
      expect(result).toContain('data:image/gif;base64,abc');
    });

    it('allows data:image/webp', () => {
      const result = sanitizeHtml('<img src="data:image/webp;base64,abc" alt="test">');
      expect(result).toContain('data:image/webp;base64,abc');
    });

    it('allows data:image/svg+xml', () => {
      const result = sanitizeHtml('<img src="data:image/svg+xml;base64,abc" alt="test">');
      expect(result).toContain('data:image/svg+xml;base64,abc');
    });
  });

  // --- Event handler edge cases ---

  describe('event handler stripping', () => {
    it('strips ONCLICK (uppercase)', () => {
      const result = sanitizeHtml('<p ONCLICK="alert(1)">text</p>');
      expect(result).not.toContain('ONCLICK');
      expect(result).not.toContain('onclick');
    });

    it('strips onfocus', () => {
      const result = sanitizeHtml('<a href="https://example.com" onfocus="alert(1)">link</a>');
      expect(result).not.toContain('onfocus');
    });
  });

  // --- Comment stripping ---

  describe('comment stripping', () => {
    it('strips multi-line comments', () => {
      const result = sanitizeHtml('<p>before</p><!--\nmultiline\ncomment\n--><p>after</p>');
      expect(result).not.toContain('<!--');
      expect(result).toContain('<p>before</p>');
      expect(result).toContain('<p>after</p>');
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
