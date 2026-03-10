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
});
