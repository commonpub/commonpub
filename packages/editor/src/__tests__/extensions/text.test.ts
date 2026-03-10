import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { SnaplifyText } from '../../extensions/text';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, SnaplifyText],
    content: content ?? '<p>Hello</p>',
    element: document.createElement('div'),
  });
}

describe('SnaplifyText Extension', () => {
  it('creates a paragraph node', () => {
    const editor = createEditor();
    expect(editor.getHTML()).toContain('<p>Hello</p>');
    editor.destroy();
  });

  it('parses paragraph HTML', () => {
    const editor = createEditor('<p>Parsed content</p>');
    expect(editor.getText()).toBe('Parsed content');
    editor.destroy();
  });

  it('supports empty paragraphs', () => {
    const editor = createEditor('<p></p>');
    expect(editor.getHTML()).toContain('<p>');
    editor.destroy();
  });
});
