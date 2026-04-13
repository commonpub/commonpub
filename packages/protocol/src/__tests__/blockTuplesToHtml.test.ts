/**
 * Tests for BlockTuple → HTML rendering in contentToArticle().
 * Covers all 15 block types, XSS prevention, and edge cases.
 *
 * blockTuplesToHtml() and sanitizeBlockHtml() are private functions
 * tested through the public contentToArticle() API.
 */
import { describe, it, expect } from 'vitest';
import { contentToArticle } from '../contentMapper';

const DOMAIN = 'test.example.com';
const author = { username: 'alice' };

function renderBlocks(blocks: unknown[]): string {
  const article = contentToArticle(
    { id: 'test', type: 'project', title: 'Test', slug: 'test', content: blocks },
    author,
    DOMAIN,
  );
  return article.content;
}

describe('blockTuplesToHtml — block type rendering', () => {
  it('renders paragraph with html', () => {
    const html = renderBlocks([['paragraph', { html: '<strong>bold</strong> text' }]]);
    expect(html).toContain('<p><strong>bold</strong> text</p>');
  });

  it('renders paragraph with text fallback (escapes HTML)', () => {
    const html = renderBlocks([['paragraph', { text: 'Hello <world>' }]]);
    expect(html).toContain('<p>Hello &lt;world&gt;</p>');
  });

  it('renders text block (alias for paragraph)', () => {
    const html = renderBlocks([['text', { html: '<em>italic</em>' }]]);
    expect(html).toContain('<p><em>italic</em></p>');
  });

  it('renders heading with correct level', () => {
    const html = renderBlocks([['heading', { level: 3, text: 'Title' }]]);
    expect(html).toContain('<h3>Title</h3>');
  });

  it('clamps heading level to 1-6', () => {
    // Note: level 0 is falsy, so Number(0) || 2 = 2 (default)
    expect(renderBlocks([['heading', { level: 0, text: 'X' }]])).toContain('<h2>');
    expect(renderBlocks([['heading', { level: 7, text: 'X' }]])).toContain('<h6>');
    // Negative: Math.max(-1, 1) = 1
    expect(renderBlocks([['heading', { level: -1, text: 'X' }]])).toContain('<h1>');
  });

  it('defaults heading level to 2 when missing', () => {
    const html = renderBlocks([['heading', { text: 'No Level' }]]);
    expect(html).toContain('<h2>No Level</h2>');
  });

  it('renders image with alt and caption', () => {
    const html = renderBlocks([['image', { url: 'https://example.com/img.jpg', alt: 'Photo', caption: 'A photo' }]]);
    expect(html).toContain('<figure>');
    expect(html).toContain('src="https://example.com/img.jpg"');
    expect(html).toContain('alt="Photo"');
    expect(html).toContain('<figcaption>A photo</figcaption>');
  });

  it('renders image without optional fields', () => {
    const html = renderBlocks([['image', { url: 'https://example.com/img.jpg' }]]);
    expect(html).toContain('<img src="https://example.com/img.jpg"');
    expect(html).not.toContain('alt=');
    expect(html).not.toContain('figcaption');
  });

  it('skips image with no url', () => {
    const html = renderBlocks([['image', {}]]);
    expect(html).toBe('');
  });

  it('renders code block with language', () => {
    const html = renderBlocks([['code_block', { code: 'const x = 1;', language: 'javascript' }]]);
    expect(html).toContain('<pre><code class="language-javascript">const x = 1;</code></pre>');
  });

  it('renders code block (alias)', () => {
    const html = renderBlocks([['code', { code: 'print("hi")' }]]);
    // escapeHtml only escapes & < > (not quotes), so " stays as "
    expect(html).toContain('<pre><code>print("hi")</code></pre>');
  });

  it('escapes HTML entities in code', () => {
    const html = renderBlocks([['code_block', { code: '<script>alert(1)</script>' }]]);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders blockquote with html', () => {
    const html = renderBlocks([['quote', { html: '<em>quoted</em>' }]]);
    expect(html).toContain('<blockquote><em>quoted</em></blockquote>');
  });

  it('renders blockquote with text fallback', () => {
    const html = renderBlocks([['blockquote', { text: 'A wise saying' }]]);
    expect(html).toContain('<blockquote><p>A wise saying</p></blockquote>');
  });

  it('renders divider', () => {
    const html = renderBlocks([['divider', {}]]);
    expect(html).toContain('<hr />');
  });

  it('renders video as link', () => {
    const html = renderBlocks([['video', { url: 'https://youtube.com/watch?v=abc', title: 'My Video' }]]);
    expect(html).toContain('href="https://youtube.com/watch?v=abc"');
    expect(html).toContain('Video: My Video');
  });

  it('renders embed as link', () => {
    const html = renderBlocks([['embed', { url: 'https://codepen.io/pen/abc', title: 'Demo' }]]);
    expect(html).toContain('href="https://codepen.io/pen/abc"');
    expect(html).toContain('Demo');
  });

  it('renders embed with default title when missing', () => {
    const html = renderBlocks([['embed', { url: 'https://example.com' }]]);
    expect(html).toContain('Embedded content');
  });

  it('renders callout with html', () => {
    const html = renderBlocks([['callout', { html: '<strong>Note:</strong> important' }]]);
    expect(html).toContain('<aside><strong>Note:</strong> important</aside>');
  });

  it('renders callout with text fallback', () => {
    const html = renderBlocks([['callout', { text: 'Warning!' }]]);
    expect(html).toContain('<aside>Warning!</aside>');
  });

  it('renders markdown block', () => {
    const html = renderBlocks([['markdown', { html: '<h2>Heading</h2><p>Body</p>' }]]);
    expect(html).toContain('<h2>Heading</h2><p>Body</p>');
  });

  it('renders build_step with title and body', () => {
    const html = renderBlocks([['build_step', { title: 'Step 1', html: 'Solder the resistor' }]]);
    expect(html).toContain('<strong>Step 1</strong>');
    expect(html).toContain('Solder the resistor');
  });

  it('renders parts_list', () => {
    const html = renderBlocks([['parts_list', { parts: [
      { name: 'Resistor 100Ω', quantity: 3 },
      { name: 'LED', quantity: 1 },
    ] }]]);
    expect(html).toContain('<h3>Parts</h3>');
    expect(html).toContain('<li>Resistor 100Ω (x3)</li>');
    expect(html).toContain('<li>LED (x1)</li>');
  });

  it('skips parts_list with empty parts', () => {
    const html = renderBlocks([['parts_list', { parts: [] }]]);
    expect(html).toBe('');
  });

  it('renders unknown block type with html', () => {
    const html = renderBlocks([['custom_widget', { html: '<span>custom</span>' }]]);
    expect(html).toContain('<div><span>custom</span></div>');
  });

  it('renders unknown block type with text fallback', () => {
    const html = renderBlocks([['custom_widget', { text: 'fallback text' }]]);
    expect(html).toContain('<p>fallback text</p>');
  });

  it('skips unknown block with no html or text', () => {
    const html = renderBlocks([['custom_widget', { data: 123 }]]);
    expect(html).toBe('');
  });
});

describe('blockTuplesToHtml — edge cases', () => {
  it('returns empty string for non-array input', () => {
    const article = contentToArticle(
      { id: 'test', type: 'project', title: 'Test', slug: 'test', content: 'just a string' },
      author, DOMAIN,
    );
    expect(article.content).toBe('just a string');
  });

  it('returns empty string for empty array', () => {
    const html = renderBlocks([]);
    expect(html).toBe('');
  });

  it('skips malformed blocks (not 2-element array)', () => {
    const html = renderBlocks([['orphan'], 'not-an-array', null, undefined]);
    expect(html).toBe('');
  });

  it('handles multiple blocks joined with newlines', () => {
    const html = renderBlocks([
      ['paragraph', { text: 'First' }],
      ['divider', {}],
      ['paragraph', { text: 'Second' }],
    ]);
    expect(html).toBe('<p>First</p>\n<hr />\n<p>Second</p>');
  });
});

describe('sanitizeBlockHtml — XSS prevention', () => {
  it('strips <script> tags with content', () => {
    const html = renderBlocks([['paragraph', { html: 'Hello<script>alert(1)</script>World' }]]);
    expect(html).toContain('HelloWorld');
    expect(html).not.toContain('script');
    expect(html).not.toContain('alert');
  });

  it('strips <style> tags with content', () => {
    const html = renderBlocks([['paragraph', { html: 'Hello<style>body{display:none}</style>World' }]]);
    expect(html).toContain('HelloWorld');
    expect(html).not.toContain('style');
  });

  it('strips event handlers (onclick)', () => {
    const html = renderBlocks([['paragraph', { html: '<a onclick="alert(1)" href="#">Click</a>' }]]);
    expect(html).not.toContain('onclick');
    expect(html).toContain('href="#"');
    expect(html).toContain('Click');
  });

  it('strips event handlers (onerror)', () => {
    const html = renderBlocks([['paragraph', { html: '<img src="x" onerror="alert(1)">' }]]);
    expect(html).not.toContain('onerror');
  });

  it('strips event handlers case-insensitive', () => {
    const html = renderBlocks([['paragraph', { html: '<div OnMouseOver="alert(1)">text</div>' }]]);
    expect(html).not.toContain('OnMouseOver');
    expect(html).not.toContain('onmouseover');
  });

  it('replaces javascript: URLs in href', () => {
    const html = renderBlocks([['paragraph', { html: '<a href="javascript:alert(1)">click</a>' }]]);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('replaces javascript: URLs in src', () => {
    const html = renderBlocks([['paragraph', { html: '<img src="javascript:alert(1)">' }]]);
    expect(html).not.toContain('javascript:');
  });

  it('strips unsafe data: URIs', () => {
    const html = renderBlocks([['paragraph', { html: '<img src="data:text/html,<script>alert(1)</script>">' }]]);
    expect(html).toContain('src=""');
  });

  it('preserves safe data:image URIs', () => {
    const html = renderBlocks([['paragraph', { html: '<img src="data:image/png;base64,abc123">' }]]);
    expect(html).toContain('data:image/png');
  });

  it('preserves safe inline HTML tags', () => {
    const html = renderBlocks([['paragraph', { html: '<strong>bold</strong> <em>italic</em> <a href="https://example.com">link</a>' }]]);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  it('handles nested script tags', () => {
    const html = renderBlocks([['paragraph', { html: '<script><script>alert(1)</script></script>' }]]);
    // Regex strips the inner <script>...</script>, leaving </script> which is just text
    expect(html).not.toContain('alert');
    expect(html).not.toContain('<script>');
  });

  it('returns empty paragraph for non-string html input', () => {
    const html = renderBlocks([['paragraph', { html: 12345 }]]);
    // data.html is truthy (12345), sanitizeBlockHtml returns '' for non-string
    // Result: <p></p> (empty paragraph)
    expect(html).toBe('<p></p>');
  });
});

describe('contentToArticle — cpub:type extension', () => {
  it('includes cpub:type matching the content type', () => {
    const article = contentToArticle(
      { id: 'test', type: 'project', title: 'Test', slug: 'test' },
      author, DOMAIN,
    );
    expect((article as Record<string, unknown>)['cpub:type']).toBe('project');
  });

  it('normalizes cpub:type article to blog', () => {
    const article = contentToArticle(
      { id: 'test', type: 'article', title: 'Test', slug: 'test' },
      author, DOMAIN,
    );
    expect((article as Record<string, unknown>)['cpub:type']).toBe('blog');
  });

  it('preserves cpub:type blog as-is', () => {
    const article = contentToArticle(
      { id: 'test', type: 'blog', title: 'Test', slug: 'test' },
      author, DOMAIN,
    );
    expect((article as Record<string, unknown>)['cpub:type']).toBe('blog');
  });

  it('preserves cpub:type explainer as-is', () => {
    const article = contentToArticle(
      { id: 'test', type: 'explainer', title: 'Test', slug: 'test' },
      author, DOMAIN,
    );
    expect((article as Record<string, unknown>)['cpub:type']).toBe('explainer');
  });

  it('uses normalized type in AP url field', () => {
    const article = contentToArticle(
      { id: 'test', type: 'article', title: 'Test', slug: 'test-post' },
      author, DOMAIN,
    );
    // URL should contain /blog/ not /article/ (article was the input type)
    expect(article.url).toContain('/blog/test-post');
    expect(article.url).not.toContain('/article/');
  });
});

describe('contentToArticle — image attachments from blocks', () => {
  it('extracts image blocks as attachments', () => {
    const article = contentToArticle(
      {
        id: 'test', type: 'project', title: 'Test', slug: 'test',
        content: [
          ['paragraph', { text: 'Hello' }],
          ['image', { url: 'https://example.com/photo.jpg', alt: 'Photo' }],
        ],
      },
      author, DOMAIN,
    );
    expect(article.attachment).toBeDefined();
    expect(article.attachment!.length).toBe(1);
    expect(article.attachment![0].url).toBe('https://example.com/photo.jpg');
    expect(article.attachment![0].name).toBe('Photo');
  });

  it('includes cover image alongside block images', () => {
    const article = contentToArticle(
      {
        id: 'test', type: 'project', title: 'Test', slug: 'test',
        coverImageUrl: 'https://example.com/cover.jpg',
        content: [['image', { url: 'https://example.com/photo.jpg' }]],
      },
      author, DOMAIN,
    );
    expect(article.attachment!.length).toBe(2);
    expect(article.attachment![0].url).toBe('https://example.com/cover.jpg');
    expect(article.attachment![1].url).toBe('https://example.com/photo.jpg');
  });

  it('handles gallery blocks with multiple images', () => {
    const article = contentToArticle(
      {
        id: 'test', type: 'project', title: 'Test', slug: 'test',
        content: [['gallery', { images: [
          { url: 'https://example.com/1.jpg', alt: 'One' },
          { url: 'https://example.com/2.jpg' },
        ] }]],
      },
      author, DOMAIN,
    );
    expect(article.attachment!.length).toBe(2);
  });
});
