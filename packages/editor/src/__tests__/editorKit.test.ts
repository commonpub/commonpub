import { describe, it, expect, vi } from 'vitest';
import { createCommonPubEditor } from '../editorKit';
import type { BlockTuple } from '../blocks/types';

describe('createCommonPubEditor', () => {
  it('creates an editor instance', () => {
    const editor = createCommonPubEditor();
    expect(editor).toBeDefined();
    expect(editor.isEditable).toBe(true);
    editor.destroy();
  });

  it('creates a read-only editor when editable=false', () => {
    const editor = createCommonPubEditor({ editable: false });
    expect(editor.isEditable).toBe(false);
    editor.destroy();
  });

  it('loads content from BlockTuples', () => {
    const content: BlockTuple[] = [
      ['heading', { text: 'Hello', level: 1 }],
      ['text', { html: '<p>World</p>' }],
    ];
    const editor = createCommonPubEditor({ content });
    const text = editor.getText();
    expect(text).toContain('Hello');
    expect(text).toContain('World');
    editor.destroy();
  });

  it('fires onUpdate callback with BlockTuples', async () => {
    const handler = vi.fn();
    const editor = createCommonPubEditor({ onUpdate: handler });

    // Insert some text
    editor.commands.insertContent('<p>New content</p>');

    // Wait for the update callback
    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalled();
    const lastCall = handler.mock.calls[handler.mock.calls.length - 1];
    const blocks = lastCall[0] as BlockTuple[];
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);

    editor.destroy();
  });

  it('includes core extensions for all 6 block types', () => {
    const editor = createCommonPubEditor();
    const nodeTypes = Object.keys(editor.schema.nodes);
    expect(nodeTypes).toContain('paragraph');
    expect(nodeTypes).toContain('heading');
    expect(nodeTypes).toContain('code_block');
    expect(nodeTypes).toContain('image');
    expect(nodeTypes).toContain('blockquote');
    expect(nodeTypes).toContain('callout');
    editor.destroy();
  });

  it('includes mark extensions', () => {
    const editor = createCommonPubEditor();
    const markTypes = Object.keys(editor.schema.marks);
    expect(markTypes).toContain('bold');
    expect(markTypes).toContain('italic');
    expect(markTypes).toContain('code');
    expect(markTypes).toContain('link');
    editor.destroy();
  });

  it('accepts additional extensions', () => {
    // Just verify it doesn't throw with extra extensions
    const editor = createCommonPubEditor({ extensions: [] });
    expect(editor).toBeDefined();
    editor.destroy();
  });
});
