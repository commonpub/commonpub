/**
 * Tests for projectBlocks — the pure block→structured-data parsers extracted
 * from ProjectView.vue (session 206). These used to be inline computeds with
 * no coverage; the view's BOM / build-steps / code / files / TOC tabs all
 * depend on them parsing CommonPub BlockTuple content correctly.
 */
import { describe, it, expect } from 'vitest';
import {
  extractParts,
  extractBuildSteps,
  extractCodeBlocks,
  extractDownloadFiles,
  extractTocEntries,
  headingSlug,
} from '../projectBlocks';

describe('projectBlocks — non-array / empty guards', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', '<p>hi</p>'],
    ['an object', { blocks: [] }],
  ])('every parser returns [] for %s content', (_label, input) => {
    expect(extractParts(input)).toEqual([]);
    expect(extractBuildSteps(input)).toEqual([]);
    expect(extractCodeBlocks(input)).toEqual([]);
    expect(extractDownloadFiles(input)).toEqual([]);
    expect(extractTocEntries(input)).toEqual([]);
  });
});

describe('extractParts', () => {
  it('maps partsList rows with qty/quantity precedence and defaults', () => {
    const blocks = [
      ['paragraph', { html: 'ignored' }],
      ['partsList', { parts: [
        { name: 'Resistor', qty: 4, productId: 'p1', notes: '1k ohm' },
        { quantity: 2 },                 // name + qty fall back; quantity used when qty absent
        { name: 'LED' },                 // quantity defaults to 1
      ] }],
    ];
    expect(extractParts(blocks)).toEqual([
      { name: 'Resistor', quantity: 4, productId: 'p1', notes: '1k ohm' },
      { name: 'Unknown', quantity: 2, productId: undefined, notes: '' },
      { name: 'LED', quantity: 1, productId: undefined, notes: '' },
    ]);
  });

  it('accumulates across multiple partsList blocks and ignores others', () => {
    const blocks = [
      ['partsList', { parts: [{ name: 'A' }] }],
      ['code_block', { code: 'x' }],
      ['partsList', { parts: [{ name: 'B' }] }],
    ];
    expect(extractParts(blocks).map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('prefers qty over quantity when both are present', () => {
    expect(extractParts([['partsList', { parts: [{ name: 'X', qty: 7, quantity: 99 }] }]])[0].quantity).toBe(7);
  });
});

describe('extractBuildSteps', () => {
  it('uses explicit children when present', () => {
    const children = [['paragraph', { html: '<p>do this</p>' }]];
    const steps = extractBuildSteps([['buildStep', { title: 'First', children, time: '5 min' }]]);
    expect(steps).toEqual([{ number: 1, title: 'First', children, time: '5 min' }]);
  });

  it('migrates legacy instructions+image into children when no children given', () => {
    const steps = extractBuildSteps([
      ['buildStep', { instructions: 'Plain text', image: 'http://img/1.png' }],
    ]);
    expect(steps[0].children).toEqual([
      ['paragraph', { html: '<p>Plain text</p>' }],
      ['image', { src: 'http://img/1.png', alt: 'Step 1', caption: '' }],
    ]);
  });

  it('does not double-wrap instructions that are already HTML', () => {
    const steps = extractBuildSteps([['buildStep', { instructions: '<h3>Heading</h3>' }]]);
    expect(steps[0].children).toEqual([['paragraph', { html: '<h3>Heading</h3>' }]]);
  });

  it('numbers steps by a running counter, honours stepNumber/title overrides, and ignores non-buildStep blocks', () => {
    const steps = extractBuildSteps([
      ['heading', { text: 'x' }],
      ['buildStep', { title: 'Cut' }],          // -> number 1, running counter
      ['buildStep', { stepNumber: 9 }],         // -> number 9 (override), title 'Step 2' (counter)
    ]);
    expect(steps.map((s) => [s.number, s.title])).toEqual([[1, 'Cut'], [9, 'Step 2']]);
  });

  it('image alt uses the running counter, not the stepNumber override', () => {
    const steps = extractBuildSteps([
      ['buildStep', { title: 'a' }],
      ['buildStep', { stepNumber: 42, image: 'i.png' }],
    ]);
    expect((steps[1].children[0][1] as { alt: string }).alt).toBe('Step 2');
  });
});

describe('extractCodeBlocks', () => {
  it('accepts both code_block and codeBlock type names with defaults', () => {
    const snippets = extractCodeBlocks([
      ['code_block', { language: 'ts', filename: 'a.ts', code: 'const a=1' }],
      ['codeBlock', { code: 'noop' }],
      ['paragraph', { html: 'x' }],
    ]);
    expect(snippets).toEqual([
      { language: 'ts', filename: 'a.ts', code: 'const a=1' },
      { language: '', filename: '', code: 'noop' },
    ]);
  });
});

describe('extractDownloadFiles', () => {
  it('flattens downloads blocks with name/url/size defaults and ignores others', () => {
    const files = extractDownloadFiles([
      ['downloads', { files: [{ name: 'case.stl', url: '/f/case.stl', size: '2 MB' }, { url: '/f/x' }] }],
      ['code_block', { code: 'x' }],
    ]);
    expect(files).toEqual([
      { name: 'case.stl', url: '/f/case.stl', size: '2 MB' },
      { name: 'Unknown', url: '/f/x', size: '' },
    ]);
  });
});

describe('headingSlug', () => {
  it('lowercases, collapses non-alphanumerics to single dashes, and trims edge dashes', () => {
    expect(headingSlug('Bill of Materials!')).toBe('bill-of-materials');
    expect(headingSlug('  --Step 1: Cut--  ')).toBe('step-1-cut');
  });
});

describe('extractTocEntries', () => {
  it('builds entries from headings: HTML-stripped label, level defaulting to 2', () => {
    const entries = extractTocEntries([
      ['heading', { text: 'Overview', level: 3 }],
      ['heading', { text: 'Wiring' }],          // level defaults to 2
      ['heading', { text: '<i></i>' }],          // empty after strip -> skipped
      ['paragraph', { html: 'not a heading' }],
    ]);
    expect(entries).toEqual([
      { id: 'overview', text: 'Overview', level: 3 },
      { id: 'wiring', text: 'Wiring', level: 2 },
    ]);
  });

  it('id matches the rendered anchor (slug of RAW text), even when heading text contains HTML', () => {
    // BlockHeadingView.vue / ArticleView.vue both slug the RAW text without
    // stripping HTML, so the TOC id MUST do the same or getElementById misses.
    const [entry] = extractTocEntries([['heading', { text: '<b>Overview</b>', level: 2 }]]);
    expect(entry.id).toBe(headingSlug('<b>Overview</b>')); // 'b-overview-b' — matches the rendered <h2 id>
    expect(entry.text).toBe('Overview');                   // label still strips HTML for display
  });
});
