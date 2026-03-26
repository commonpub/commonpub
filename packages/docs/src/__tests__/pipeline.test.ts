import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../render/pipeline';

describe('renderMarkdown', () => {
  it('should render basic markdown to HTML', async () => {
    const result = await renderMarkdown('# Hello\n\nA paragraph.');
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<p>A paragraph.</p>');
  }, 60000);

  it('should extract frontmatter', async () => {
    const md = `---
title: My Page
description: About this page
---

## Content here`;

    const result = await renderMarkdown(md);
    expect(result.frontmatter.title).toBe('My Page');
    expect(result.frontmatter.description).toBe('About this page');
    expect(result.html).not.toContain('---');
  });

  it('should extract table of contents', async () => {
    const md = `## Introduction
### Setup
## Usage`;

    const result = await renderMarkdown(md);
    expect(result.toc).toHaveLength(3);
    expect(result.toc[0]!.text).toBe('Introduction');
    expect(result.toc[0]!.level).toBe(2);
    expect(result.toc[1]!.text).toBe('Setup');
    expect(result.toc[2]!.text).toBe('Usage');
  });

  it('should render GFM tables', async () => {
    const md = `| Header | Value |
| --- | --- |
| A | 1 |`;

    const result = await renderMarkdown(md);
    expect(result.html).toContain('<table>');
    expect(result.html).toContain('<th>');
  });

  it('should render fenced code blocks', async () => {
    const md = '```js\nconsole.log("hello");\n```';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('console');
  });

  it('should render GFM strikethrough', async () => {
    const md = '~~deleted~~';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('<del>');
  });

  it('should render GFM task lists', async () => {
    const md = '- [x] Done\n- [ ] Todo';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('type="checkbox"');
  });

  it('should handle empty content', async () => {
    const result = await renderMarkdown('');
    expect(result.html).toBe('');
    expect(result.toc).toEqual([]);
    expect(result.frontmatter).toEqual({});
  });

  it('should render links', async () => {
    const md = '[Click here](https://example.com)';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('href="https://example.com"');
    expect(result.html).toContain('Click here');
  });

  it('should render images', async () => {
    const md = '![Alt text](image.png)';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('<img');
    expect(result.html).toContain('alt="Alt text"');
  });

  it('should add ids to headings via rehype-slug', async () => {
    const md = '## My Section';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('id=');
  });

  it('should render blockquotes', async () => {
    const md = '> Important note';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('<blockquote>');
  });

  it('should handle frontmatter-only content', async () => {
    const md = `---
title: Just Frontmatter
---`;

    const result = await renderMarkdown(md);
    expect(result.frontmatter.title).toBe('Just Frontmatter');
  });

  it('should render inline code', async () => {
    const md = 'Use `const x = 1` in your code.';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('<code>');
  });

  it('should render nested lists', async () => {
    const md = '- Item 1\n  - Nested\n- Item 2';
    const result = await renderMarkdown(md);
    expect(result.html).toContain('<ul>');
    // Nested list should be inside a list item
    const ulCount = (result.html.match(/<ul>/g) || []).length;
    expect(ulCount).toBeGreaterThanOrEqual(2);
  });
});
