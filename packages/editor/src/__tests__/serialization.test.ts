/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  blockTuplesToDoc,
  docToBlockTuples,
  validateBlockTuples,
  buildEditorSchema,
} from '../serialization';
import { clearRegistry, registerCoreBlocks } from '../blocks/registry';
import type { BlockTuple } from '../blocks/types';

describe('Serialization', () => {
  beforeEach(() => {
    clearRegistry();
    registerCoreBlocks();
  });

  describe('validateBlockTuples', () => {
    it('validates correct block tuples', () => {
      const result = validateBlockTuples([
        ['text', { html: '<p>Hello</p>' }],
        ['heading', { text: 'Title', level: 2 }],
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('rejects structurally invalid input', () => {
      const result = validateBlockTuples('not an array');
      expect(result.success).toBe(false);
    });

    it('rejects invalid content for registered type', () => {
      const result = validateBlockTuples([['heading', { text: 'T', level: 99 }]]);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('rejects unknown block type', () => {
      const result = validateBlockTuples([['unknown', { data: 'test' }]]);
      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('unknown type');
    });
  });

  describe('Round-trip: blockTuplesToDoc → docToBlockTuples', () => {
    const schema = buildEditorSchema();

    it('round-trips text block', () => {
      const blocks: BlockTuple[] = [['text', { html: '<p>Hello world</p>' }]];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('text');
      expect((result[0]![1] as any).html).toContain('Hello world');
    });

    it('round-trips heading block', () => {
      const blocks: BlockTuple[] = [['heading', { text: 'My Title', level: 2 }]];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('heading');
      expect((result[0]![1] as any).text).toBe('My Title');
      expect((result[0]![1] as any).level).toBe(2);
    });

    it('round-trips code block', () => {
      const blocks: BlockTuple[] = [
        ['code', { code: 'console.log("hi")', language: 'typescript' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('code');
      expect((result[0]![1] as any).code).toBe('console.log("hi")');
      expect((result[0]![1] as any).language).toBe('typescript');
    });

    it('round-trips code block with filename', () => {
      const blocks: BlockTuple[] = [
        ['code', { code: 'fn main() {}', language: 'rust', filename: 'main.rs' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).filename).toBe('main.rs');
    });

    it('round-trips image block', () => {
      const blocks: BlockTuple[] = [
        ['image', { src: 'https://example.com/img.png', alt: 'Test image' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('image');
      expect((result[0]![1] as any).src).toBe('https://example.com/img.png');
      expect((result[0]![1] as any).alt).toBe('Test image');
    });

    it('round-trips quote block', () => {
      const blocks: BlockTuple[] = [
        ['quote', { html: '<p>To be or not to be</p>', attribution: 'Shakespeare' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('quote');
      expect((result[0]![1] as any).html).toContain('To be or not to be');
      expect((result[0]![1] as any).attribution).toBe('Shakespeare');
    });

    it('round-trips callout block', () => {
      const blocks: BlockTuple[] = [
        ['callout', { html: '<p>Important note</p>', variant: 'warning' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('callout');
      expect((result[0]![1] as any).html).toContain('Important note');
      expect((result[0]![1] as any).variant).toBe('warning');
    });

    it('round-trips multiple blocks', () => {
      const blocks: BlockTuple[] = [
        ['heading', { text: 'Introduction', level: 1 }],
        ['text', { html: '<p>First paragraph.</p>' }],
        ['code', { code: 'const x = 1;', language: 'javascript' }],
        ['text', { html: '<p>Second paragraph.</p>' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(4);
      expect(result[0]![0]).toBe('heading');
      expect(result[1]![0]).toBe('text');
      expect(result[2]![0]).toBe('code');
      expect(result[3]![0]).toBe('text');
    });
  });

  describe('Round-trip: all block types', () => {
    const schema = buildEditorSchema();

    it('round-trips gallery block', () => {
      const blocks: BlockTuple[] = [
        ['gallery', { images: [{ src: 'a.jpg', alt: 'A' }] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('gallery');
      expect((result[0]![1] as any).images).toEqual([{ src: 'a.jpg', alt: 'A' }]);
    });

    it('round-trips video block', () => {
      const blocks: BlockTuple[] = [
        ['video', { url: 'https://youtube.com/watch?v=abc', platform: 'youtube' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('video');
      expect((result[0]![1] as any).url).toBe('https://youtube.com/watch?v=abc');
      expect((result[0]![1] as any).platform).toBe('youtube');
    });

    it('round-trips video block with caption', () => {
      const blocks: BlockTuple[] = [
        ['video', { url: 'https://youtube.com/watch?v=abc', platform: 'youtube', caption: 'A video' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).caption).toBe('A video');
    });

    it('round-trips embed block', () => {
      const blocks: BlockTuple[] = [
        ['embed', { url: 'https://codepen.io/abc', type: 'codepen' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('embed');
      expect((result[0]![1] as any).url).toBe('https://codepen.io/abc');
      expect((result[0]![1] as any).type).toBe('codepen');
    });

    it('round-trips embed block with html', () => {
      const blocks: BlockTuple[] = [
        ['embed', { url: 'https://codepen.io/abc', type: 'codepen', html: '<iframe></iframe>' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).html).toBe('<iframe></iframe>');
    });

    it('round-trips partsList block', () => {
      const blocks: BlockTuple[] = [
        ['partsList', { parts: [{ name: 'LED', qty: 5 }] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('partsList');
      expect((result[0]![1] as any).parts).toEqual([{ name: 'LED', qty: 5 }]);
    });

    it('round-trips toolList block', () => {
      const blocks: BlockTuple[] = [
        ['toolList', { tools: [{ name: 'Soldering iron' }] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('toolList');
      expect((result[0]![1] as any).tools).toEqual([{ name: 'Soldering iron' }]);
    });

    it('round-trips downloads block', () => {
      const blocks: BlockTuple[] = [
        ['downloads', { files: [{ name: 'schematic.pdf', url: '/files/s.pdf' }] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('downloads');
      expect((result[0]![1] as any).files).toEqual([{ name: 'schematic.pdf', url: '/files/s.pdf' }]);
    });

    it('round-trips buildStep block', () => {
      const blocks: BlockTuple[] = [
        ['buildStep', { stepNumber: 1, instructions: 'Solder the LED' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('buildStep');
      expect((result[0]![1] as any).stepNumber).toBe(1);
      expect((result[0]![1] as any).instructions).toBe('Solder the LED');
    });

    it('round-trips buildStep block with optional fields', () => {
      const blocks: BlockTuple[] = [
        ['buildStep', { stepNumber: 2, instructions: 'Attach wires', image: 'step2.jpg', time: '5 min', partsUsed: ['wire', 'tape'] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).image).toBe('step2.jpg');
      expect((result[0]![1] as any).time).toBe('5 min');
      expect((result[0]![1] as any).partsUsed).toEqual(['wire', 'tape']);
    });

    it('round-trips quiz block', () => {
      const blocks: BlockTuple[] = [
        ['quiz', { question: 'What is 2+2?', options: [{ text: '4', correct: true }] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('quiz');
      expect((result[0]![1] as any).question).toBe('What is 2+2?');
      expect((result[0]![1] as any).options).toEqual([{ text: '4', correct: true }]);
    });

    it('round-trips quiz block with feedback', () => {
      const blocks: BlockTuple[] = [
        ['quiz', { question: 'Q?', options: [{ text: 'A', correct: true }], feedback: 'Correct!' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).feedback).toBe('Correct!');
    });

    it('round-trips interactiveSlider block', () => {
      const blocks: BlockTuple[] = [
        ['interactiveSlider', { label: 'Voltage', min: 0, max: 12, step: 1, defaultValue: 5, states: [] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('interactiveSlider');
      expect((result[0]![1] as any).label).toBe('Voltage');
      expect((result[0]![1] as any).min).toBe(0);
      expect((result[0]![1] as any).max).toBe(12);
      expect((result[0]![1] as any).step).toBe(1);
      expect((result[0]![1] as any).defaultValue).toBe(5);
      expect((result[0]![1] as any).states).toEqual([]);
    });

    it('round-trips interactiveSlider block with states', () => {
      const states = [{ value: 3, label: 'Low' }, { value: 9, label: 'High' }];
      const blocks: BlockTuple[] = [
        ['interactiveSlider', { label: 'Power', min: 0, max: 10, step: 1, defaultValue: 5, states }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).states).toEqual(states);
    });

    it('round-trips checkpoint block', () => {
      const blocks: BlockTuple[] = [
        ['checkpoint', { message: 'Check your work' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('checkpoint');
      expect((result[0]![1] as any).message).toBe('Check your work');
    });

    it('round-trips mathNotation block', () => {
      const blocks: BlockTuple[] = [
        ['mathNotation', { expression: 'E=mc^2', display: true }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('mathNotation');
      expect((result[0]![1] as any).expression).toBe('E=mc^2');
      expect((result[0]![1] as any).display).toBe(true);
    });

    it('round-trips mathNotation block with display false', () => {
      const blocks: BlockTuple[] = [
        ['mathNotation', { expression: 'x^2' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).expression).toBe('x^2');
      expect((result[0]![1] as any).display).toBe(false);
    });

    it('round-trips markdown block', () => {
      const blocks: BlockTuple[] = [
        ['markdown', { source: '# Hello' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('markdown');
      expect((result[0]![1] as any).source).toBe('# Hello');
    });

    it('round-trips divider block', () => {
      const blocks: BlockTuple[] = [
        ['divider', {}],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('divider');
      expect(result[0]![1]).toEqual({});
    });

    it('round-trips image block with caption', () => {
      const blocks: BlockTuple[] = [
        ['image', { src: 'https://example.com/img.jpg', alt: 'Photo', caption: 'A photo' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('image');
      expect((result[0]![1] as any).src).toBe('https://example.com/img.jpg');
      expect((result[0]![1] as any).alt).toBe('Photo');
      expect((result[0]![1] as any).caption).toBe('A photo');
    });

    it('round-trips quote block without attribution', () => {
      const blocks: BlockTuple[] = [
        ['quote', { html: '<p>Just a quote</p>' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('quote');
      expect((result[0]![1] as any).html).toContain('Just a quote');
      // attribution should not be present when not set
      expect((result[0]![1] as any).attribution).toBeUndefined();
    });

    it('round-trips callout with different variants', () => {
      const variants = ['info', 'warning', 'danger', 'success'];
      for (const variant of variants) {
        const blocks: BlockTuple[] = [
          ['callout', { html: `<p>${variant} message</p>`, variant }],
        ];
        const doc = blockTuplesToDoc(blocks, schema);
        const result = docToBlockTuples(doc);
        expect(result).toHaveLength(1);
        expect((result[0]![1] as any).variant).toBe(variant);
        expect((result[0]![1] as any).html).toContain(`${variant} message`);
      }
    });

    it('round-trips heading with all levels', () => {
      for (const level of [1, 2, 3, 4]) {
        const blocks: BlockTuple[] = [
          ['heading', { text: `Level ${level}`, level }],
        ];
        const doc = blockTuplesToDoc(blocks, schema);
        const result = docToBlockTuples(doc);
        expect(result).toHaveLength(1);
        expect((result[0]![1] as any).text).toBe(`Level ${level}`);
        expect((result[0]![1] as any).level).toBe(level);
      }
    });

    it('round-trips list block (unordered)', () => {
      const blocks: BlockTuple[] = [
        ['list', { ordered: false, items: ['<p>Item 1</p>', '<p>Item 2</p>'] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('list');
      expect((result[0]![1] as any).ordered).toBe(false);
      expect((result[0]![1] as any).items).toHaveLength(2);
      expect((result[0]![1] as any).items[0]).toContain('Item 1');
      expect((result[0]![1] as any).items[1]).toContain('Item 2');
    });

    it('round-trips list block (ordered)', () => {
      const blocks: BlockTuple[] = [
        ['list', { ordered: true, items: ['<p>First</p>', '<p>Second</p>'] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('list');
      expect((result[0]![1] as any).ordered).toBe(true);
      expect((result[0]![1] as any).items).toHaveLength(2);
    });
  });

  describe('Round-trip edge cases', () => {
    const schema = buildEditorSchema();

    it('round-trips text block with empty HTML', () => {
      const blocks: BlockTuple[] = [['text', { html: '' }]];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('text');
      // Empty HTML should produce an empty paragraph
      expect((result[0]![1] as any).html).toBeDefined();
    });

    it('round-trips code block with empty language', () => {
      const blocks: BlockTuple[] = [
        ['code', { code: 'x', language: '' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('code');
      expect((result[0]![1] as any).code).toBe('x');
      expect((result[0]![1] as any).language).toBe('');
    });

    it('round-trips gallery with empty images array', () => {
      const blocks: BlockTuple[] = [
        ['gallery', { images: [] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect(result[0]![0]).toBe('gallery');
      expect((result[0]![1] as any).images).toEqual([]);
    });

    it('round-trips image block without caption (caption omitted in output)', () => {
      const blocks: BlockTuple[] = [
        ['image', { src: 'img.png', alt: 'test' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).src).toBe('img.png');
      expect((result[0]![1] as any).alt).toBe('test');
      // caption should not be present when falsy
      expect((result[0]![1] as any).caption).toBeUndefined();
    });

    it('round-trips buildStep block without optional fields', () => {
      const blocks: BlockTuple[] = [
        ['buildStep', { stepNumber: 1, instructions: 'Do it' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      // Optional fields should not appear in output
      expect((result[0]![1] as any).image).toBeUndefined();
      expect((result[0]![1] as any).time).toBeUndefined();
      expect((result[0]![1] as any).partsUsed).toBeUndefined();
    });

    it('round-trips quiz block without feedback', () => {
      const blocks: BlockTuple[] = [
        ['quiz', { question: 'Q?', options: [{ text: 'A', correct: false }] }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).feedback).toBeUndefined();
    });

    it('round-trips embed block without html', () => {
      const blocks: BlockTuple[] = [
        ['embed', { url: 'https://example.com', type: 'generic' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).html).toBeUndefined();
    });

    it('round-trips video block without caption', () => {
      const blocks: BlockTuple[] = [
        ['video', { url: 'https://vimeo.com/123', platform: 'vimeo' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).caption).toBeUndefined();
    });

    it('round-trips code block without filename (filename omitted)', () => {
      const blocks: BlockTuple[] = [
        ['code', { code: 'print("hi")', language: 'python' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).filename).toBeUndefined();
    });

    it('round-trips partsList with multiple parts', () => {
      const parts = [{ name: 'LED', qty: 5 }, { name: 'Resistor', qty: 10, value: '220ohm' }];
      const blocks: BlockTuple[] = [
        ['partsList', { parts }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).parts).toEqual(parts);
    });

    it('round-trips toolList with multiple tools', () => {
      const tools = [{ name: 'Soldering iron' }, { name: 'Multimeter', optional: true }];
      const blocks: BlockTuple[] = [
        ['toolList', { tools }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).tools).toEqual(tools);
    });

    it('round-trips downloads with multiple files', () => {
      const files = [{ name: 'schematic.pdf', url: '/a.pdf' }, { name: 'code.zip', url: '/b.zip' }];
      const blocks: BlockTuple[] = [
        ['downloads', { files }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).files).toEqual(files);
    });

    it('round-trips gallery with multiple images', () => {
      const images = [
        { src: 'a.jpg', alt: 'A', caption: 'Photo A' },
        { src: 'b.jpg', alt: 'B' },
      ];
      const blocks: BlockTuple[] = [
        ['gallery', { images }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).images).toEqual(images);
    });

    it('round-trips markdown with empty source', () => {
      const blocks: BlockTuple[] = [
        ['markdown', { source: '' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).source).toBe('');
    });

    it('round-trips checkpoint with empty message', () => {
      const blocks: BlockTuple[] = [
        ['checkpoint', { message: '' }],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(1);
      expect((result[0]![1] as any).message).toBe('');
    });

    it('round-trips a full document with every block type', () => {
      const blocks: BlockTuple[] = [
        ['heading', { text: 'Project Guide', level: 1 }],
        ['text', { html: '<p>Introduction paragraph.</p>' }],
        ['callout', { html: '<p>Safety first!</p>', variant: 'danger' }],
        ['partsList', { parts: [{ name: 'LED', qty: 2 }] }],
        ['toolList', { tools: [{ name: 'Pliers' }] }],
        ['buildStep', { stepNumber: 1, instructions: 'Gather materials' }],
        ['image', { src: 'step1.jpg', alt: 'Step 1', caption: 'Completed step' }],
        ['code', { code: 'setup()', language: 'python' }],
        ['quote', { html: '<p>Measure twice, cut once.</p>' }],
        ['video', { url: 'https://youtube.com/watch?v=123', platform: 'youtube' }],
        ['gallery', { images: [{ src: 'result.jpg', alt: 'Result' }] }],
        ['downloads', { files: [{ name: 'plans.pdf', url: '/plans.pdf' }] }],
        ['mathNotation', { expression: 'V=IR', display: true }],
        ['quiz', { question: 'Did it work?', options: [{ text: 'Yes', correct: true }] }],
        ['checkpoint', { message: 'Review your build' }],
        ['markdown', { source: '**Done!**' }],
        ['embed', { url: 'https://codepen.io/pen', type: 'codepen' }],
        ['interactiveSlider', { label: 'Speed', min: 0, max: 100, step: 5, defaultValue: 50, states: [] }],
        ['divider', {}],
      ];
      const doc = blockTuplesToDoc(blocks, schema);
      const result = docToBlockTuples(doc);
      expect(result).toHaveLength(blocks.length);
      // Verify each block type came back correctly
      const expectedTypes = blocks.map(([type]) => type);
      const actualTypes = result.map(([type]) => type);
      expect(actualTypes).toEqual(expectedTypes);
    });
  });
});
