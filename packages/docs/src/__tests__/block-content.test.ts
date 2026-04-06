import { describe, it, expect } from 'vitest';
import { createDocsPageSchema, updateDocsPageSchema } from '../validators';
import { stripBlockTuples } from '../search/indexer';

// ═══ VALIDATOR TESTS: BlockTuple content field ═══

describe('createDocsPageSchema — block content', () => {
  const base = {
    versionId: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Page',
    slug: 'test-page',
  };

  it('should accept string content (legacy markdown)', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: '# Hello\n\nMarkdown content here.',
    });
    expect(result.success).toBe(true);
  });

  it('should accept BlockTuple array content', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: [
        ['paragraph', { html: '<p>Hello world</p>' }],
        ['heading', { text: 'Getting Started', level: 2 }],
        ['code_block', { code: 'const x = 1;', language: 'typescript' }],
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty BlockTuple array', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: [],
    });
    expect(result.success).toBe(true);
  });

  it('should accept single-block array', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: [['paragraph', { html: '' }]],
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty string content', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject number content', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: 42,
    });
    expect(result.success).toBe(false);
  });

  it('should reject null content', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: null,
    });
    expect(result.success).toBe(false);
  });

  it('should reject object content (not array, not string)', () => {
    const result = createDocsPageSchema.safeParse({
      ...base,
      content: { html: '<p>not a tuple</p>' },
    });
    expect(result.success).toBe(false);
  });
});

describe('updateDocsPageSchema — block content', () => {
  it('should accept BlockTuple array in partial update', () => {
    const result = updateDocsPageSchema.safeParse({
      content: [
        ['paragraph', { html: '<p>Updated content</p>' }],
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept string content in partial update', () => {
    const result = updateDocsPageSchema.safeParse({
      content: '# Updated markdown',
    });
    expect(result.success).toBe(true);
  });

  it('should accept update without content', () => {
    const result = updateDocsPageSchema.safeParse({
      title: 'New Title',
    });
    expect(result.success).toBe(true);
  });
});

// ═══ TEXT EXTRACTION: BlockTuple → plain text for search ═══

describe('stripBlockTuples', () => {
  it('should extract text from paragraph blocks', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['paragraph', { html: '<p>Hello <strong>world</strong></p>' }],
      ['paragraph', { html: '<p>Second paragraph with <a href="/link">a link</a></p>' }],
    ];
    const text = stripBlockTuples(blocks);
    expect(text).toContain('Hello world');
    expect(text).toContain('Second paragraph with a link');
    expect(text).not.toContain('<p>');
    expect(text).not.toContain('<strong>');
    expect(text).not.toContain('href');
  });

  it('should extract text from heading blocks', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['heading', { text: 'Getting Started', level: 2 }],
      ['paragraph', { html: '<p>Content here</p>' }],
    ];
    const text = stripBlockTuples(blocks);
    expect(text).toContain('Getting Started');
    expect(text).toContain('Content here');
  });

  it('should extract code from code blocks', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['code_block', { code: 'const x = 1;', language: 'typescript', filename: 'example.ts' }],
    ];
    const text = stripBlockTuples(blocks);
    expect(text).toContain('const x = 1');
  });

  it('should extract text from quote blocks', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['blockquote', { html: '<p>A wise quote</p>', attribution: 'Someone' }],
    ];
    const text = stripBlockTuples(blocks);
    expect(text).toContain('A wise quote');
    expect(text).toContain('Someone');
  });

  it('should extract text from callout blocks', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['callout', { html: '<p>Important note</p>', variant: 'warning' }],
    ];
    const text = stripBlockTuples(blocks);
    expect(text).toContain('Important note');
    expect(text).not.toContain('warning');
  });

  it('should extract alt/caption from image blocks', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['image', { src: 'https://example.com/img.png', alt: 'Diagram of the system', caption: 'Figure 1' }],
    ];
    const text = stripBlockTuples(blocks);
    expect(text).toContain('Diagram of the system');
    expect(text).toContain('Figure 1');
    expect(text).not.toContain('https://');
  });

  it('should handle empty blocks array', () => {
    const text = stripBlockTuples([]);
    expect(text).toBe('');
  });

  it('should handle blocks with missing content gracefully', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['paragraph', {}],
      ['heading', {}],
      ['divider', {}],
    ];
    const text = stripBlockTuples(blocks);
    expect(typeof text).toBe('string');
  });

  it('should ignore block type names and structural JSON', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['paragraph', { html: '<p>Real content</p>' }],
    ];
    const text = stripBlockTuples(blocks);
    expect(text).not.toContain('paragraph');
    expect(text).not.toContain('html');
    expect(text).toContain('Real content');
  });

  it('should join multiple blocks with spaces', () => {
    const blocks: [string, Record<string, unknown>][] = [
      ['heading', { text: 'Title', level: 2 }],
      ['paragraph', { html: '<p>Body text</p>' }],
    ];
    const text = stripBlockTuples(blocks);
    // Should have both, separated, not concatenated
    expect(text).toMatch(/Title\s+Body text/);
  });
});
