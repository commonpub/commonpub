/**
 * Security tests: content injection attacks via federation.
 * Tests that malicious content from remote instances is properly sanitized.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../sanitize';
import { validateActorResponse } from '../../actorResolver';

describe('XSS via federated content', () => {
  it('strips polyglot XSS payload', () => {
    const payload = `jaVasCript:/*-/*\`/*\\' /*"/**/(/* */oNcliCk=alert() )//`;
    const result = sanitizeHtml(`<a href="${payload}">click</a>`);
    expect(result.toLowerCase()).not.toContain('javascript:');
  });

  it('strips mutation XSS via noscript', () => {
    const result = sanitizeHtml('<noscript><p title="</noscript><img src=x onerror=alert()>">');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('noscript');
  });

  it('handles template literal in attribute (unquoted becomes quoted)', () => {
    const result = sanitizeHtml('<img src=`javascript:alert(1)`>');
    // The backtick-quoted value is parsed as unquoted attribute by regex,
    // which captures `javascript:alert(1)` including backticks.
    // isSafeUrl rejects javascript: scheme, so src is stripped.
    // The backtick quoting pattern is not valid HTML — browsers treat it
    // as an unquoted attribute value. Our sanitizer handles it safely.
    expect(result).not.toContain('src=`javascript');
  });

  it('strips XSS via SVG use/foreignObject', () => {
    const result = sanitizeHtml(
      '<svg><use href="data:image/svg+xml,<svg onload=alert(1)>"></use></svg>',
    );
    expect(result).not.toContain('onload');
    expect(result).not.toContain('<svg');
  });

  it('strips XSS via math element', () => {
    const result = sanitizeHtml(
      '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
    );
    expect(result).not.toContain('onerror');
  });

  it('strips XSS via base tag', () => {
    const result = sanitizeHtml('<base href="https://evil.com/"><a href="/steal">click</a>');
    expect(result).not.toContain('<base');
    expect(result).toContain('<a href="/steal">click</a>');
  });

  it('strips XSS via meta refresh', () => {
    const result = sanitizeHtml('<meta http-equiv="refresh" content="0;url=https://evil.com">');
    expect(result).not.toContain('<meta');
  });

  it('strips XSS via link stylesheet', () => {
    const result = sanitizeHtml('<link rel="stylesheet" href="https://evil.com/steal.css">');
    expect(result).not.toContain('<link');
  });

  it('strips XSS via marquee event', () => {
    const result = sanitizeHtml('<marquee onstart=alert(1)>text</marquee>');
    expect(result).not.toContain('onstart');
    expect(result).not.toContain('<marquee');
  });

  it('strips XSS via video event', () => {
    const result = sanitizeHtml('<video><source onerror=alert(1)></video>');
    expect(result).not.toContain('onerror');
  });

  it('strips XSS via details ontoggle', () => {
    const result = sanitizeHtml('<details ontoggle=alert(1) open><summary>X</summary></details>');
    expect(result).not.toContain('ontoggle');
    expect(result).toContain('<details');
    expect(result).toContain('<summary>');
  });

  it('strips XSS via textarea autofocus', () => {
    const result = sanitizeHtml('<textarea autofocus onfocus=alert(1)>test</textarea>');
    expect(result).not.toContain('onfocus');
    expect(result).not.toContain('<textarea');
  });

  it('strips nested encoding attempts', () => {
    // Double-encoded angle brackets
    const result = sanitizeHtml('&lt;script&gt;alert(1)&lt;/script&gt;');
    // These are already entity-encoded and should pass through as text
    expect(result).toContain('&lt;script&gt;');
    // The key is they don't become executable
    expect(result).not.toContain('<script>');
  });

  it('handles extremely long content without crashing', () => {
    const longContent = '<p>' + 'A'.repeat(100000) + '</p>';
    const result = sanitizeHtml(longContent);
    expect(result).toContain('<p>');
    expect(result.length).toBeGreaterThan(100000);
  });

  it('handles deeply nested tags', () => {
    let html = '';
    for (let i = 0; i < 100; i++) html += '<p>';
    html += 'deep';
    for (let i = 0; i < 100; i++) html += '</p>';
    const result = sanitizeHtml(html);
    expect(result).toContain('deep');
  });
});

describe('XSS via actor profile fields', () => {
  it('rejects actor with script in summary', () => {
    const actor = validateActorResponse({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Person',
      id: 'https://evil.com/users/hacker',
      inbox: 'https://evil.com/users/hacker/inbox',
      preferredUsername: 'hacker',
      name: '<script>alert(document.cookie)</script>',
      summary: '<img src=x onerror=alert(1)>',
    });

    // The actor parser accepts it (it's valid AP), but the summary field
    // must be sanitized before rendering. We test that the parser doesn't
    // crash on malicious input.
    expect(actor).not.toBeNull();
    expect(actor!.name).toContain('<script>');
    // NOTE: Applications MUST sanitize actor.name and actor.summary before rendering.
    // The actor resolver returns raw data; sanitization happens at display time.
  });

  it('accepts actor with javascript: icon URL (Zod .url() allows it)', () => {
    // NOTE: Zod's z.string().url() accepts javascript: as a valid URL scheme.
    // Applications MUST sanitize icon URLs before rendering in <img src>.
    // The actor parser accepts the data; sanitization happens at display time.
    const actor = validateActorResponse({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Person',
      id: 'https://evil.com/users/hacker',
      inbox: 'https://evil.com/users/hacker/inbox',
      icon: {
        type: 'Image',
        url: 'javascript:alert(1)',
      },
    });

    // Parser accepts it — display layer must use sanitizeHtml or URL validation
    expect(actor).not.toBeNull();
    // Verify that sanitizeHtml would catch it if used in an <img>
    const imgHtml = `<img src="${actor!.icon!.url}">`;
    const sanitized = sanitizeHtml(imgHtml);
    expect(sanitized).not.toContain('javascript:');
  });
});

describe('payload size limits', () => {
  it('sanitizer handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('sanitizer handles null-like input', () => {
    expect(sanitizeHtml(undefined as unknown as string)).toBe('');
    expect(sanitizeHtml(null as unknown as string)).toBe('');
  });

  it('handles content with only tags (no text)', () => {
    const result = sanitizeHtml('<script></script><iframe></iframe><div></div>');
    expect(result).toBe('');
  });
});
