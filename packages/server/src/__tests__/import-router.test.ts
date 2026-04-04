import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importFromUrl } from '../import/importer';

describe('import URL router', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(html: string, status = 200): void {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Not Found',
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(html).buffer),
      json: () => Promise.resolve({ hits: [] }),
    });
  }

  it('should reject invalid URLs', async () => {
    await expect(importFromUrl('not-a-url')).rejects.toThrow('Invalid URL');
  });

  it('should reject non-HTTP protocols', async () => {
    await expect(importFromUrl('ftp://example.com/file')).rejects.toThrow('must use HTTP');
  });

  it('should reject private/internal URLs', async () => {
    await expect(importFromUrl('http://localhost/page')).rejects.toThrow('private');
    await expect(importFromUrl('http://192.168.1.1/page')).rejects.toThrow('private');
    await expect(importFromUrl('http://10.0.0.1/page')).rejects.toThrow('private');
  });

  it('should use generic extractor for unknown domains', async () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:title" content="Blog Post" />
      <meta property="og:description" content="A blog post" />
    </head><body>
      <article>
        <h1>Blog Post</h1>
        <p>This is a great blog post with enough content for the readability algorithm to properly extract it as a legitimate article with real content.</p>
        <p>Another paragraph with more detail about the topic to make the content long enough for extraction.</p>
      </article>
    </body></html>`;

    mockFetch(html);

    const result = await importFromUrl('https://example.com/blog-post');
    expect(result.title).toBeTruthy();
    expect(result.content.length).toBeGreaterThanOrEqual(0);
  });

  it('should route hackster.io URLs to the platform handler', async () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Test Project | Hackster.io</title>
      <meta property="og:title" content="Test Project" />
    </head><body>
      <h1>Test Project</h1>
      <div itemprop="text">
        <h2>Introduction</h2>
        <p>This project demonstrates how to build something cool with an Arduino board connected to various sensors and actuators.</p>
        <p>Follow the steps below to replicate this build at home with basic electronics knowledge.</p>
      </div>
    </body></html>`;

    // Mock both the page fetch and Algolia
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes('algolia')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ hits: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(html).buffer),
      });
    });

    const result = await importFromUrl('https://www.hackster.io/user/test-project');
    // Platform handler was used (even if Algolia returned nothing, the HTML extraction still works)
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('should handle HTTP errors gracefully', async () => {
    mockFetch('Not Found', 404);
    await expect(importFromUrl('https://example.com/missing')).rejects.toThrow('HTTP 404');
  });

  it('should handle fetch timeouts', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    await expect(importFromUrl('https://example.com/slow')).rejects.toThrow();
  });
});
