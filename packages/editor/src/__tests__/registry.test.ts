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
      registerBlock({ type: 'text', schema: textContentSchema, label: 'Text 2' }),
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
    it('registers all core block types', () => {
      registerCoreBlocks();
      const blocks = listBlocks();
      expect(blocks).toHaveLength(21);
      const types = blocks.map((b) => b.type).sort();
      expect(types).toContain('text');
      expect(types).toContain('heading');
      expect(types).toContain('code');
      expect(types).toContain('image');
      expect(types).toContain('quote');
      expect(types).toContain('callout');
      expect(types).toContain('gallery');
      expect(types).toContain('video');
      expect(types).toContain('embed');
      expect(types).toContain('markdown');
      expect(types).toContain('divider');
      expect(types).toContain('partsList');
      expect(types).toContain('buildStep');
      expect(types).toContain('toolList');
      expect(types).toContain('downloads');
      expect(types).toContain('quiz');
      expect(types).toContain('interactiveSlider');
      expect(types).toContain('checkpoint');
      expect(types).toContain('mathNotation');
      expect(types).toContain('sectionHeader');
      expect(types).toContain('table');
    });

    it('is idempotent', () => {
      registerCoreBlocks();
      registerCoreBlocks();
      expect(listBlocks()).toHaveLength(21);
    });

    it('validates the markdown-imported table block the parser emits', () => {
      // Regression: mapTable emits ['table', { header, rows }] but the core registry
      // never registered it, so validateBlock failed and the preview showed "unknown".
      registerCoreBlocks();
      expect(lookupBlock('table')).toBeDefined();
      const ok = validateBlock(['table', { header: ['A', 'B'], rows: [['1', '2'], ['3', '4']] }]);
      expect(ok.success).toBe(true);
      const bad = validateBlock(['table', { header: 'nope', rows: [] }]);
      expect(bad.success).toBe(false);
    });
  });
});
