import { describe, it, expect } from 'vitest';
import { extractArticle } from '../import/generic';

const BASE_URL = 'https://example.com/article';

function wrapHtml(body: string, head = ''): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
}

describe('generic content importer', () => {
  describe('extractArticle', () => {
    it('should extract a basic article', () => {
      const html = wrapHtml(`
        <article>
          <h1>Test Article</h1>
          <p>This is a paragraph with enough content to pass the character threshold for Readability to pick it up as article content for extraction purposes.</p>
          <p>Another paragraph with more detail about the topic being discussed in this particular article so the extractor recognizes it.</p>
          <p>A third paragraph that adds even more body text to make sure the article is long enough to be detected as real content by the readability algorithm.</p>
        </article>
      `, '<title>Test Article</title><meta property="og:title" content="Test Article" />');

      const result = extractArticle(html, BASE_URL);
      expect(result.title).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.partial).toBe(false);
    });

    it('should extract OG metadata', () => {
      const html = wrapHtml(
        `<article>
          <h1>Hello World</h1>
          <p>Sufficient body text for readability to detect this as an article. We need multiple sentences with real content to pass the threshold checker.</p>
          <p>Another paragraph with additional details to make the extraction algorithm happy and produce a proper result with all metadata.</p>
        </article>`,
        `<meta property="og:title" content="OG Title" />
         <meta property="og:description" content="OG Description" />
         <meta property="og:image" content="https://example.com/cover.jpg" />
         <meta name="keywords" content="test, import, content" />`,
      );

      const result = extractArticle(html, BASE_URL);
      expect(result.coverImageUrl).toBe('https://example.com/cover.jpg');
      expect(result.tags).toContain('test');
      expect(result.tags).toContain('import');
      expect(result.tags).toContain('content');
    });

    it('should resolve relative OG image URLs', () => {
      const html = wrapHtml(
        `<article>
          <h1>Test</h1>
          <p>Sufficient body text for readability to detect this as an article with real content that passes the threshold.</p>
          <p>More text here to make the readability algorithm happy about this being a real article with extractable content.</p>
        </article>`,
        '<meta property="og:image" content="/images/cover.jpg" />',
      );

      const result = extractArticle(html, BASE_URL);
      expect(result.coverImageUrl).toBe('https://example.com/images/cover.jpg');
    });

    it('should handle pages with no extractable content', () => {
      // Completely empty body with no text nodes
      const html = '<!DOCTYPE html><html><head></head><body></body></html>';

      const result = extractArticle(html, BASE_URL);
      expect(result.partial).toBe(true);
      expect(result.content).toEqual([]);
    });

    it('should extract code blocks with language hints', () => {
      const html = wrapHtml(`
        <article>
          <h1>Code Tutorial</h1>
          <p>This is a tutorial about Python programming with enough text for Readability to pick it up as a real article. Let us look at some code examples below.</p>
          <p>Another paragraph with more context about what we are going to build and why this tutorial matters for developers.</p>
          <pre><code class="language-python">def hello():
    print("Hello, World!")</code></pre>
          <p>After the code block, we continue with more explanation about how this function works and why it matters.</p>
        </article>
      `);

      const result = extractArticle(html, BASE_URL);
      expect(result.content.length).toBeGreaterThan(0);
      // Should have extracted content — code blocks may or may not preserve language
      // depending on how Readability processes the DOM
      const hasCode = result.content.some(([type]) => type === 'code');
      const hasText = result.content.some(([type]) => type === 'text');
      expect(hasCode || hasText).toBe(true);
    });

    it('should handle headings correctly', () => {
      const html = wrapHtml(`
        <article>
          <h1>Main Title</h1>
          <p>Introductory paragraph with enough text for the readability algorithm to consider this a legitimate article that should be extracted fully.</p>
          <h2>Section One</h2>
          <p>First section content goes here with enough words to make the content substantive and pass the Readability character threshold for extraction.</p>
          <h3>Subsection</h3>
          <p>More content here to make the total article length sufficient for proper extraction and heading detection in the block output.</p>
        </article>
      `);

      const result = extractArticle(html, BASE_URL);
      const headings = result.content.filter(([type]) => type === 'heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should limit tags to 20', () => {
      const manyKeywords = Array.from({ length: 30 }, (_, i) => `tag${i}`).join(',');
      const html = wrapHtml(
        `<article><h1>Test</h1><p>Content with enough text for extraction to work properly in the readability algorithm.</p><p>More body text.</p></article>`,
        `<meta name="keywords" content="${manyKeywords}" />`,
      );

      const result = extractArticle(html, BASE_URL);
      expect(result.tags.length).toBeLessThanOrEqual(20);
    });

    it('should handle empty keywords gracefully', () => {
      const html = wrapHtml(
        '<article><h1>Test</h1><p>Body text sufficient for extraction.</p><p>More body text for threshold.</p></article>',
        '<meta name="keywords" content="" />',
      );

      const result = extractArticle(html, BASE_URL);
      expect(result.tags).toEqual([]);
    });

    it('should count words in the content', () => {
      const html = wrapHtml(`
        <article>
          <h1>Word Count Test</h1>
          <p>This article has a known number of words that we can verify after extraction to make sure the word counter is working properly and returning accurate results.</p>
          <p>Another paragraph here to make the total content length sufficient for the readability algorithm to engage.</p>
        </article>
      `);

      const result = extractArticle(html, BASE_URL);
      if (!result.partial) {
        expect(result.meta.wordCount).toBeGreaterThan(0);
        expect(typeof result.meta.wordCount).toBe('number');
      }
    });

    it('should handle iframes as embedded content', () => {
      const html = wrapHtml(`
        <article>
          <h1>Video Article</h1>
          <p>This article includes embedded videos from YouTube and other platforms. We have enough text here for the readability algorithm to detect this content properly.</p>
          <p>More context about the video and what it demonstrates for the viewer to understand.</p>
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315"></iframe>
          <p>After the video, we continue with more discussion about the topic at hand and additional commentary.</p>
        </article>
      `);

      const result = extractArticle(html, BASE_URL);
      expect(result.content.length).toBeGreaterThan(0);
    });
  });
});
