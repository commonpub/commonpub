import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubQuote } from '../../extensions/quote';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubQuote],
    content: content ?? '<blockquote><p>Quoted text</p></blockquote>',
    element: document.createElement('div'),
  });
}

describe('CommonPubQuote Extension', () => {
  it('parses blockquote HTML', () => {
    const editor = createEditor();
    expect(editor.getHTML()).toContain('<blockquote>');
    expect(editor.getText()).toContain('Quoted text');
    editor.destroy();
  });

  it('renders blockquote structure', () => {
    const editor = createEditor('<blockquote><p>A wise quote</p></blockquote>');
    expect(editor.getHTML()).toContain('<blockquote>');
    expect(editor.getHTML()).toContain('A wise quote');
    editor.destroy();
  });

  it('has setBlockquote command', () => {
    const editor = createEditor('<p>Some text</p>');
    // Select all text first
    editor.commands.selectAll();
    editor.commands.setBlockquote();
    expect(editor.getHTML()).toContain('<blockquote>');
    editor.destroy();
  });
});
