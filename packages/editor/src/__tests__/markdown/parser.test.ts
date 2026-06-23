import { describe, it, expect } from 'vitest';
import { markdownToBlockTuples } from '../../markdown/parser.js';

describe('markdownToBlockTuples', () => {
  it('returns empty array for empty input', () => {
    expect(markdownToBlockTuples('')).toEqual([]);
    expect(markdownToBlockTuples('   ')).toEqual([]);
  });

  it('converts headings', () => {
    const blocks = markdownToBlockTuples('# Title\n\n## Subtitle\n\n### Section');
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual(['heading', { text: 'Title', level: 1 }]);
    expect(blocks[1]).toEqual(['heading', { text: 'Subtitle', level: 2 }]);
    expect(blocks[2]).toEqual(['heading', { text: 'Section', level: 3 }]);
  });

  it('clamps heading level to 4', () => {
    const blocks = markdownToBlockTuples('##### Deep\n\n###### Deeper');
    expect(blocks[0]![1]).toHaveProperty('level', 4);
    expect(blocks[1]![1]).toHaveProperty('level', 4);
  });

  it('converts paragraphs with inline formatting', () => {
    const blocks = markdownToBlockTuples('Hello **bold** and *italic* world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]![0]).toBe('text');
    const html = (blocks[0]![1] as { html: string }).html;
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('converts code fences with language', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const blocks = markdownToBlockTuples(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual(['code', { code: 'const x = 1;', language: 'typescript' }]);
  });

  it('parses lang:filename from code fence info', () => {
    const md = '```ts:utils.ts\nexport function foo() {}\n```';
    const blocks = markdownToBlockTuples(md);
    expect(blocks[0]).toEqual(['code', { code: 'export function foo() {}', language: 'ts', filename: 'utils.ts' }]);
  });

  it('converts images', () => {
    const blocks = markdownToBlockTuples('![Alt text](https://example.com/img.png)');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual(['image', { src: 'https://example.com/img.png', alt: 'Alt text', caption: '' }]);
  });

  it('converts standalone image in paragraph', () => {
    const blocks = markdownToBlockTuples('![photo](https://example.com/photo.jpg)');
    expect(blocks[0]![0]).toBe('image');
  });

  it('converts blockquotes', () => {
    const blocks = markdownToBlockTuples('> This is a quote');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]![0]).toBe('quote');
    expect((blocks[0]![1] as { html: string }).html).toContain('This is a quote');
  });

  it('converts Obsidian callouts', () => {
    const blocks = markdownToBlockTuples('> [!TIP] Useful advice\n> Do this thing');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]![0]).toBe('callout');
    expect((blocks[0]![1] as { variant: string }).variant).toBe('tip');
  });

  it('maps Obsidian NOTE to info variant', () => {
    const blocks = markdownToBlockTuples('> [!NOTE]\n> Important info');
    expect((blocks[0]![1] as { variant: string }).variant).toBe('info');
  });

  it('maps Obsidian WARNING to warning variant', () => {
    const blocks = markdownToBlockTuples('> [!WARNING]\n> Be careful');
    expect((blocks[0]![1] as { variant: string }).variant).toBe('warning');
  });

  it('maps Obsidian DANGER to danger variant', () => {
    const blocks = markdownToBlockTuples('> [!DANGER]\n> Very risky');
    expect((blocks[0]![1] as { variant: string }).variant).toBe('danger');
  });

  it('converts dividers', () => {
    const blocks = markdownToBlockTuples('---');
    expect(blocks).toEqual([['divider', {}]]);
  });

  it('converts unordered lists to text blocks with HTML', () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    const blocks = markdownToBlockTuples(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]![0]).toBe('text');
    const html = (blocks[0]![1] as { html: string }).html;
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
  });

  it('converts ordered lists', () => {
    const md = '1. First\n2. Second';
    const blocks = markdownToBlockTuples(md);
    expect(blocks[0]![0]).toBe('text');
    expect((blocks[0]![1] as { html: string }).html).toContain('<ol>');
  });

  it('converts GFM tables to a structured table block', () => {
    const md = '| Name | Value |\n| --- | --- |\n| A | 1 |\n| B | 2 |';
    const blocks = markdownToBlockTuples(md);
    expect(blocks[0]![0]).toBe('table');
    const t = blocks[0]![1] as { header: string[]; rows: string[][] };
    expect(t.header).toEqual(['Name', 'Value']);
    expect(t.rows).toEqual([['A', '1'], ['B', '2']]);
  });

  it('handles wikilinks by stripping to plain text', () => {
    const blocks = markdownToBlockTuples('See [[My Page]] for details');
    expect(blocks[0]![0]).toBe('text');
    expect((blocks[0]![1] as { html: string }).html).toContain('My Page');
    expect((blocks[0]![1] as { html: string }).html).not.toContain('[[');
  });

  it('handles wikilinks with display text', () => {
    const blocks = markdownToBlockTuples('Check [[My Page|this page]]');
    expect((blocks[0]![1] as { html: string }).html).toContain('this page');
    expect((blocks[0]![1] as { html: string }).html).not.toContain('My Page');
  });

  it('handles links in markdown', () => {
    const blocks = markdownToBlockTuples('Visit [Example](https://example.com)');
    expect((blocks[0]![1] as { html: string }).html).toContain('href="https://example.com"');
  });

  it('handles a full document', () => {
    const md = `# Project Title

This is a description with **bold** text.

## Getting Started

\`\`\`bash
npm install
\`\`\`

![Screenshot](https://example.com/screen.png)

> [!TIP]
> Remember to read the docs

---

- Step 1
- Step 2
- Step 3`;

    const blocks = markdownToBlockTuples(md);
    expect(blocks.length).toBeGreaterThanOrEqual(7);

    expect(blocks[0]).toEqual(['heading', { text: 'Project Title', level: 1 }]);
    expect(blocks[1]![0]).toBe('text');
    expect(blocks[2]).toEqual(['heading', { text: 'Getting Started', level: 2 }]);
    expect(blocks[3]![0]).toBe('code');
    expect(blocks[4]![0]).toBe('image');
    expect(blocks[5]![0]).toBe('callout');
    // divider
    // list
  });

  it('handles inline code', () => {
    const blocks = markdownToBlockTuples('Use `npm install` to start');
    expect((blocks[0]![1] as { html: string }).html).toContain('<code>');
  });

  it('handles strikethrough (GFM)', () => {
    const blocks = markdownToBlockTuples('This is ~~deleted~~ text');
    expect((blocks[0]![1] as { html: string }).html).toContain('<del>');
  });

  it('handles raw HTML pass-through', () => {
    const blocks = markdownToBlockTuples('<div class="custom">Content</div>');
    expect(blocks[0]![0]).toBe('text');
  });

  describe('oversized input guard', () => {
    it('parses normally just under the 100k ceiling', () => {
      // A large-but-legal document still gets the real markdown treatment.
      const md = '# Heading\n\n' + 'word '.repeat(15000); // ~75k chars
      const blocks = markdownToBlockTuples(md);
      expect(blocks[0]).toEqual(['heading', { text: 'Heading', level: 1 }]);
      expect(blocks.length).toBeGreaterThan(1);
    });

    it('degrades oversized input to a single escaped plain-text block (no parse)', () => {
      // Past the ceiling we skip the synchronous parse entirely so SSR can't
      // be stalled by a pathological input — content is preserved as plain text.
      const md = 'A'.repeat(100_001);
      const blocks = markdownToBlockTuples(md);
      expect(blocks).toHaveLength(1);
      expect(blocks[0]![0]).toBe('text');
      expect((blocks[0]![1] as { html: string }).html).toBe(`<p>${'A'.repeat(100_001)}</p>`);
    });

    it('HTML-escapes the oversized plain-text fallback', () => {
      const md = '<script>alert(1)</script>'.padEnd(100_001, '.');
      const blocks = markdownToBlockTuples(md);
      const html = (blocks[0]![1] as { html: string }).html;
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('renders many block nodes without rebuilding the processor per node', () => {
      // Regression guard for the per-node `unified()` instantiation: 2k blocks
      // (kept under the 100k char ceiling) must each map to a block, proving the
      // shared-processor path handles a high node count.
      const md = Array.from({ length: 2000 }, (_, i) => `Paragraph ${i} with **bold**.`).join('\n\n');
      expect(md.length).toBeLessThan(100_000);
      const blocks = markdownToBlockTuples(md);
      expect(blocks.length).toBe(2000);
      expect(blocks[0]![0]).toBe('text');
    }, 30_000); // 2k-node parse is heavy; generous timeout so it can't flake under parallel load
  });
});
