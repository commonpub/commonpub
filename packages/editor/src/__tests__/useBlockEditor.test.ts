/**
 * Tests for the useBlockEditor composable (packages/editor/vue/composables/useBlockEditor.ts)
 *
 * These tests import the composable directly and run without a full Vue component mount,
 * since useBlockEditor is pure composition API (ref/computed/readonly).
 */
import { describe, it, expect, beforeEach } from 'vitest';

// We need to test the composable — it uses Vue reactivity
// The vue package is a dev dependency
import { useBlockEditor } from '../../vue/composables/useBlockEditor';
import type { BlockTuple } from '../index';

describe('useBlockEditor', () => {
  describe('initialization', () => {
    it('starts empty when no initial blocks provided', () => {
      const editor = useBlockEditor();
      expect(editor.blocks.value).toHaveLength(0);
      expect(editor.isEmpty.value).toBe(true);
      expect(editor.selectedBlockId.value).toBeNull();
      expect(editor.selectedBlock.value).toBeNull();
    });

    it('initializes from BlockTuple array', () => {
      const tuples: BlockTuple[] = [
        ['paragraph', { html: '<p>Hello</p>' }],
        ['heading', { text: 'Title', level: 2 }],
      ];
      const editor = useBlockEditor(tuples);
      expect(editor.blocks.value).toHaveLength(2);
      expect(editor.blocks.value[0].type).toBe('paragraph');
      expect(editor.blocks.value[0].content.html).toBe('<p>Hello</p>');
      expect(editor.blocks.value[1].type).toBe('heading');
      expect(editor.blocks.value[1].content.level).toBe(2);
      expect(editor.isEmpty.value).toBe(false);
    });

    it('generates unique IDs for each block', () => {
      const tuples: BlockTuple[] = [
        ['paragraph', { html: '' }],
        ['paragraph', { html: '' }],
      ];
      const editor = useBlockEditor(tuples);
      expect(editor.blocks.value[0].id).not.toBe(editor.blocks.value[1].id);
      expect(editor.blocks.value[0].id).toMatch(/^blk-/);
    });

    it('ignores empty initial blocks array', () => {
      const editor = useBlockEditor([]);
      expect(editor.blocks.value).toHaveLength(0);
      expect(editor.isEmpty.value).toBe(true);
    });
  });

  describe('addBlock', () => {
    it('adds a block with defaults', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph');
      expect(editor.blocks.value).toHaveLength(1);
      expect(editor.blocks.value[0].type).toBe('paragraph');
      expect(editor.blocks.value[0].content.html).toBe('');
      expect(editor.blocks.value[0].id).toBe(id);
      expect(editor.selectedBlockId.value).toBe(id);
    });

    it('adds a block with custom attrs merged over defaults', () => {
      const editor = useBlockEditor();
      editor.addBlock('heading', { text: 'Custom', level: 3 });
      expect(editor.blocks.value[0].content.text).toBe('Custom');
      expect(editor.blocks.value[0].content.level).toBe(3);
    });

    it('inserts at specific index', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'first' });
      editor.addBlock('paragraph', { html: 'third' });
      editor.addBlock('paragraph', { html: 'second' }, 1);

      expect(editor.blocks.value).toHaveLength(3);
      expect(editor.blocks.value[0].content.html).toBe('first');
      expect(editor.blocks.value[1].content.html).toBe('second');
      expect(editor.blocks.value[2].content.html).toBe('third');
    });

    it('appends when index is out of range', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'first' });
      editor.addBlock('paragraph', { html: 'last' }, 999);
      expect(editor.blocks.value).toHaveLength(2);
      expect(editor.blocks.value[1].content.html).toBe('last');
    });

    it('uses empty object for unknown block types', () => {
      const editor = useBlockEditor();
      editor.addBlock('unknown_type');
      expect(editor.blocks.value[0].content).toEqual({});
    });

    it('inserts image block with src and alt from asset upload', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'before' });
      editor.addBlock('paragraph', { html: 'after' });

      // Insert image after first block (simulating asset insert)
      editor.addBlock('image', { src: 'https://cdn.example.com/photo.webp', alt: 'My photo' }, 1);

      expect(editor.blocks.value).toHaveLength(3);
      expect(editor.blocks.value[1].type).toBe('image');
      expect(editor.blocks.value[1].content.src).toBe('https://cdn.example.com/photo.webp');
      expect(editor.blocks.value[1].content.alt).toBe('My photo');
    });

    it('inserts image at end when no block selected', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'content' });
      editor.addBlock('image', { src: 'https://cdn.example.com/img.png', alt: 'test' });

      expect(editor.blocks.value).toHaveLength(2);
      expect(editor.blocks.value[1].type).toBe('image');
      expect(editor.blocks.value[1].content.src).toBe('https://cdn.example.com/img.png');
    });
  });

  describe('removeBlock', () => {
    it('removes a block by ID', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph');
      expect(editor.blocks.value).toHaveLength(1);
      editor.removeBlock(id);
      expect(editor.blocks.value).toHaveLength(0);
    });

    it('clears selection when selected block is removed', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph');
      expect(editor.selectedBlockId.value).toBe(id);
      editor.removeBlock(id);
      expect(editor.selectedBlockId.value).toBeNull();
    });

    it('keeps selection when non-selected block is removed', () => {
      const editor = useBlockEditor();
      const id1 = editor.addBlock('paragraph');
      const id2 = editor.addBlock('paragraph');
      editor.selectBlock(id1);
      editor.removeBlock(id2);
      expect(editor.selectedBlockId.value).toBe(id1);
    });

    it('does nothing for nonexistent ID', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph');
      editor.removeBlock('nonexistent');
      expect(editor.blocks.value).toHaveLength(1);
    });
  });

  describe('updateBlock', () => {
    it('merges new content into existing block', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('heading', { text: 'Title', level: 2 });
      editor.updateBlock(id, { text: 'Updated Title' });
      expect(editor.blocks.value[0].content.text).toBe('Updated Title');
      expect(editor.blocks.value[0].content.level).toBe(2); // preserved
    });

    it('does nothing for nonexistent ID', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'original' });
      editor.updateBlock('nonexistent', { html: 'changed' });
      expect(editor.blocks.value[0].content.html).toBe('original');
    });
  });

  describe('replaceBlock', () => {
    it('replaces a block type in-place', () => {
      const editor = useBlockEditor();
      const oldId = editor.addBlock('paragraph', { html: 'text' });
      const newId = editor.replaceBlock(oldId, 'heading', { text: 'Heading' });

      expect(editor.blocks.value).toHaveLength(1);
      expect(editor.blocks.value[0].type).toBe('heading');
      expect(editor.blocks.value[0].id).toBe(newId);
      expect(newId).not.toBe(oldId);
      expect(editor.selectedBlockId.value).toBe(newId);
    });

    it('adds block if ID not found', () => {
      const editor = useBlockEditor();
      editor.replaceBlock('nonexistent', 'paragraph');
      expect(editor.blocks.value).toHaveLength(1);
      expect(editor.blocks.value[0].type).toBe('paragraph');
    });
  });

  describe('moveBlock', () => {
    let editor: ReturnType<typeof useBlockEditor>;

    beforeEach(() => {
      editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'A' });
      editor.addBlock('paragraph', { html: 'B' });
      editor.addBlock('paragraph', { html: 'C' });
    });

    it('moves block forward', () => {
      editor.moveBlock(0, 2);
      expect(editor.blocks.value[0].content.html).toBe('B');
      expect(editor.blocks.value[1].content.html).toBe('C');
      expect(editor.blocks.value[2].content.html).toBe('A');
    });

    it('moves block backward', () => {
      editor.moveBlock(2, 0);
      expect(editor.blocks.value[0].content.html).toBe('C');
      expect(editor.blocks.value[1].content.html).toBe('A');
      expect(editor.blocks.value[2].content.html).toBe('B');
    });

    it('ignores out-of-range indices', () => {
      editor.moveBlock(-1, 0);
      editor.moveBlock(0, 5);
      expect(editor.blocks.value[0].content.html).toBe('A');
    });
  });

  describe('moveBlockUp / moveBlockDown', () => {
    it('moves block up by ID', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'A' });
      const id = editor.addBlock('paragraph', { html: 'B' });
      editor.moveBlockUp(id);
      expect(editor.blocks.value[0].content.html).toBe('B');
      expect(editor.blocks.value[1].content.html).toBe('A');
    });

    it('does nothing when already at top', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph', { html: 'A' });
      editor.addBlock('paragraph', { html: 'B' });
      editor.moveBlockUp(id);
      expect(editor.blocks.value[0].content.html).toBe('A');
    });

    it('moves block down by ID', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph', { html: 'A' });
      editor.addBlock('paragraph', { html: 'B' });
      editor.moveBlockDown(id);
      expect(editor.blocks.value[0].content.html).toBe('B');
      expect(editor.blocks.value[1].content.html).toBe('A');
    });
  });

  describe('duplicateBlock', () => {
    it('creates a deep copy after the original', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('heading', { text: 'Title', level: 2 });
      editor.duplicateBlock(id);

      expect(editor.blocks.value).toHaveLength(2);
      expect(editor.blocks.value[1].type).toBe('heading');
      expect(editor.blocks.value[1].content.text).toBe('Title');
      expect(editor.blocks.value[1].id).not.toBe(id);
      // Verify deep copy — mutating clone shouldn't affect original
      expect(editor.blocks.value[0].content).not.toBe(editor.blocks.value[1].content);
    });

    it('selects the duplicated block', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph');
      editor.duplicateBlock(id);
      expect(editor.selectedBlockId.value).toBe(editor.blocks.value[1].id);
    });

    it('does nothing for nonexistent ID', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph');
      editor.duplicateBlock('nonexistent');
      expect(editor.blocks.value).toHaveLength(1);
    });
  });

  describe('clearBlocks', () => {
    it('removes all blocks and clears selection', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph');
      editor.addBlock('heading');
      editor.clearBlocks();
      expect(editor.blocks.value).toHaveLength(0);
      expect(editor.isEmpty.value).toBe(true);
      expect(editor.selectedBlockId.value).toBeNull();
    });
  });

  describe('selectBlock', () => {
    it('sets selectedBlockId', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph');
      editor.selectBlock(null);
      expect(editor.selectedBlockId.value).toBeNull();
      editor.selectBlock(id);
      expect(editor.selectedBlockId.value).toBe(id);
    });

    it('selectedBlock computed returns the block', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('heading', { text: 'Test' });
      editor.selectBlock(id);
      expect(editor.selectedBlock.value?.type).toBe('heading');
      expect(editor.selectedBlock.value?.content.text).toBe('Test');
    });
  });

  describe('getBlockIndex', () => {
    it('returns correct index', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph');
      const id = editor.addBlock('heading');
      editor.addBlock('code_block');
      expect(editor.getBlockIndex(id)).toBe(1);
    });

    it('returns -1 for nonexistent ID', () => {
      const editor = useBlockEditor();
      expect(editor.getBlockIndex('nonexistent')).toBe(-1);
    });
  });

  describe('serialization', () => {
    it('round-trips through BlockTuple format', () => {
      const original: BlockTuple[] = [
        ['paragraph', { html: '<p>Hello</p>' }],
        ['heading', { text: 'Title', level: 2 }],
        ['code_block', { code: 'console.log()', language: 'js', filename: '' }],
      ];

      const editor = useBlockEditor(original);
      const output = editor.toBlockTuples();

      expect(output).toHaveLength(3);
      expect(output[0]).toEqual(['paragraph', { html: '<p>Hello</p>' }]);
      expect(output[1]).toEqual(['heading', { text: 'Title', level: 2 }]);
      expect(output[2]).toEqual(['code_block', { code: 'console.log()', language: 'js', filename: '' }]);
    });

    it('fromBlockTuples replaces existing blocks', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'old' });

      editor.fromBlockTuples([['heading', { text: 'New', level: 1 }]]);
      expect(editor.blocks.value).toHaveLength(1);
      expect(editor.blocks.value[0].type).toBe('heading');
    });
  });

  describe('undo/redo', () => {
    it('undo reverts addBlock', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'text' });
      expect(editor.blocks.value).toHaveLength(1);
      expect(editor.canUndo.value).toBe(true);

      editor.undo();
      expect(editor.blocks.value).toHaveLength(0);
      expect(editor.canUndo.value).toBe(false);
    });

    it('redo restores undone addBlock', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'text' });
      editor.undo();
      expect(editor.blocks.value).toHaveLength(0);
      expect(editor.canRedo.value).toBe(true);

      editor.redo();
      expect(editor.blocks.value).toHaveLength(1);
      expect(editor.blocks.value[0].content.html).toBe('text');
    });

    it('undo reverts removeBlock', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph', { html: 'keep me' });
      editor.removeBlock(id);
      expect(editor.blocks.value).toHaveLength(0);

      editor.undo();
      expect(editor.blocks.value).toHaveLength(1);
      expect(editor.blocks.value[0].content.html).toBe('keep me');
    });

    it('undo reverts moveBlock', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'A' });
      editor.addBlock('paragraph', { html: 'B' });
      editor.moveBlock(0, 1);
      expect(editor.blocks.value[0].content.html).toBe('B');

      editor.undo();
      expect(editor.blocks.value[0].content.html).toBe('A');
      expect(editor.blocks.value[1].content.html).toBe('B');
    });

    it('undo reverts replaceBlock', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph', { html: 'original' });
      editor.replaceBlock(id, 'heading', { text: 'replaced' });
      expect(editor.blocks.value[0].type).toBe('heading');

      editor.undo();
      expect(editor.blocks.value[0].type).toBe('paragraph');
      expect(editor.blocks.value[0].content.html).toBe('original');
    });

    it('undo reverts duplicateBlock', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph', { html: 'dup' });
      editor.duplicateBlock(id);
      expect(editor.blocks.value).toHaveLength(2);

      editor.undo();
      expect(editor.blocks.value).toHaveLength(1);
    });

    it('undo reverts clearBlocks', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'A' });
      editor.addBlock('heading', { text: 'B', level: 2 });
      editor.clearBlocks();
      expect(editor.blocks.value).toHaveLength(0);

      editor.undo();
      expect(editor.blocks.value).toHaveLength(2);
      expect(editor.blocks.value[0].content.html).toBe('A');
      expect(editor.blocks.value[1].content.text).toBe('B');
    });

    it('new mutation after undo truncates redo history', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'A' });
      editor.addBlock('paragraph', { html: 'B' });
      editor.undo(); // back to just A
      expect(editor.canRedo.value).toBe(true);

      editor.addBlock('heading', { text: 'C' }); // branch
      expect(editor.canRedo.value).toBe(false);
      expect(editor.blocks.value).toHaveLength(2);
      expect(editor.blocks.value[1].type).toBe('heading');
    });

    it('undo returns false when at beginning', () => {
      const editor = useBlockEditor();
      expect(editor.undo()).toBe(false);
      expect(editor.canUndo.value).toBe(false);
    });

    it('redo returns false when at end', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph');
      expect(editor.redo()).toBe(false);
      expect(editor.canRedo.value).toBe(false);
    });

    it('multiple undo/redo cycles work correctly', () => {
      const editor = useBlockEditor();
      editor.addBlock('paragraph', { html: 'A' });
      editor.addBlock('paragraph', { html: 'B' });
      editor.addBlock('paragraph', { html: 'C' });

      editor.undo(); // remove C
      editor.undo(); // remove B
      expect(editor.blocks.value).toHaveLength(1);

      editor.redo(); // restore B
      expect(editor.blocks.value).toHaveLength(2);

      editor.redo(); // restore C
      expect(editor.blocks.value).toHaveLength(3);
    });

    it('respects MAX_HISTORY limit', () => {
      const editor = useBlockEditor();
      // Add 55 blocks (exceeds 50 max)
      for (let i = 0; i < 55; i++) {
        editor.addBlock('paragraph', { html: `block-${i}` });
      }

      // Should be able to undo up to MAX_HISTORY times but not all 55
      let undoCount = 0;
      while (editor.undo()) undoCount++;
      expect(undoCount).toBeLessThanOrEqual(50);
      expect(undoCount).toBeGreaterThan(0);
    });

    it('preserves selection state through undo/redo', () => {
      const editor = useBlockEditor();
      const id1 = editor.addBlock('paragraph', { html: 'A' });
      editor.selectBlock(id1);
      const id2 = editor.addBlock('paragraph', { html: 'B' }); // auto-selects id2

      editor.undo(); // remove B, should restore selection to id1
      expect(editor.selectedBlockId.value).toBe(id1);
    });

    it('updateBlock does NOT push to history (text edits use TipTap undo)', () => {
      const editor = useBlockEditor();
      const id = editor.addBlock('paragraph', { html: 'initial' });
      const undosBefore = editor.canUndo.value;

      editor.updateBlock(id, { html: 'updated' });
      // canUndo should not change from the updateBlock itself
      // (it was true from addBlock, stays true from addBlock)
      expect(editor.blocks.value[0].content.html).toBe('updated');

      editor.undo(); // should undo the addBlock, not the updateBlock
      expect(editor.blocks.value).toHaveLength(0);
    });

    it('undo preserves deep content independence', () => {
      const editor = useBlockEditor();
      editor.addBlock('gallery', { images: [{ src: 'a.jpg' }, { src: 'b.jpg' }] });
      editor.undo();
      editor.redo();

      // Verify the restored content is a deep copy, not a reference
      const images = editor.blocks.value[0].content.images as Array<{ src: string }>;
      expect(images).toHaveLength(2);
      expect(images[0].src).toBe('a.jpg');
    });
  });

  describe('custom blockDefaults option', () => {
    it('overrides specific block defaults', () => {
      const editor = useBlockEditor(undefined, {
        blockDefaults: {
          paragraph: () => ({ html: '<p>Custom default</p>' }),
        },
      });
      editor.addBlock('paragraph');
      expect(editor.blocks.value[0].content.html).toBe('<p>Custom default</p>');
    });

    it('preserves built-in defaults for non-overridden types', () => {
      const editor = useBlockEditor(undefined, {
        blockDefaults: {
          paragraph: () => ({ html: 'custom' }),
        },
      });
      editor.addBlock('heading');
      expect(editor.blocks.value[0].content.level).toBe(2);
    });
  });

  describe('init history', () => {
    it('should not double-push history when initialBlocks are provided', () => {
      const editor = useBlockEditor([
        ['paragraph', { html: 'Hello' }],
        ['heading', { text: 'Title', level: 2 }],
      ]);
      // After init with blocks, canUndo should be false (only one snapshot)
      expect(editor.canUndo.value).toBe(false);
      // Making a change should then enable undo
      editor.addBlock('paragraph');
      expect(editor.canUndo.value).toBe(true);
      // Undoing should restore to exactly the initial 2-block state
      editor.undo();
      expect(editor.blocks.value).toHaveLength(2);
    });

    it('should have single history entry when initialized empty', () => {
      const editor = useBlockEditor();
      expect(editor.canUndo.value).toBe(false);
      editor.addBlock('paragraph');
      expect(editor.canUndo.value).toBe(true);
      editor.undo();
      expect(editor.blocks.value).toHaveLength(0);
    });
  });
});
