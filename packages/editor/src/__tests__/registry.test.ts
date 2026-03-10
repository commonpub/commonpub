import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerBlock,
  lookupBlock,
  listBlocks,
  validateBlock,
  clearRegistry,
  registerCoreBlocks,
} from '../blocks/registry';
import { textContentSchema } from '../blocks/schemas';
import { z } from 'zod';

describe('Block Registry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('registers and looks up a block', () => {
    registerBlock({ type: 'text', schema: textContentSchema, label: 'Text' });
    const block = lookupBlock('text');
    expect(block).toBeDefined();
    expect(block!.type).toBe('text');
    expect(block!.label).toBe('Text');
  });

  it('returns undefined for unknown block type', () => {
    expect(lookupBlock('nonexistent')).toBeUndefined();
  });

  it('throws on duplicate registration', () => {
    registerBlock({ type: 'text', schema: textContentSchema, label: 'Text' });
    expect(() =>
      registerBlock({ type: 'text', schema: textContentSchema, label: 'Text 2' })
    ).toThrow('Block type "text" is already registered');
  });

  it('lists all registered blocks', () => {
    registerBlock({ type: 'text', schema: textContentSchema, label: 'Text' });
    registerBlock({
      type: 'custom',
      schema: z.object({ data: z.string() }),
      label: 'Custom',
    });
    const blocks = listBlocks();
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.type)).toContain('text');
    expect(blocks.map((b) => b.type)).toContain('custom');
  });

  it('validates a valid block tuple', () => {
    registerBlock({ type: 'text', schema: textContentSchema, label: 'Text' });
    const result = validateBlock(['text', { html: '<p>Hello</p>' }]);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid block tuple', () => {
    registerBlock({ type: 'text', schema: textContentSchema, label: 'Text' });
    const result = validateBlock(['text', { notHtml: 123 }]);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects unknown block type', () => {
    const result = validateBlock(['unknown', { data: 'test' }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown block type');
  });

  describe('registerCoreBlocks', () => {
    it('registers all 6 core block types', () => {
      registerCoreBlocks();
      const blocks = listBlocks();
      expect(blocks).toHaveLength(6);
      expect(blocks.map((b) => b.type).sort()).toEqual([
        'callout',
        'code',
        'heading',
        'image',
        'quote',
        'text',
      ]);
    });

    it('is idempotent', () => {
      registerCoreBlocks();
      registerCoreBlocks();
      expect(listBlocks()).toHaveLength(6);
    });
  });
});
