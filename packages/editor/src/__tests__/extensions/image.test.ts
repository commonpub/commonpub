import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { SnaplifyText } from '../../extensions/text';
import { SnaplifyImage } from '../../extensions/image';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, SnaplifyText, SnaplifyImage],
    content: content ?? '<p>Text</p>',
    element: document.createElement('div'),
  });
}

describe('SnaplifyImage Extension', () => {
  it('parses image HTML', () => {
    const editor = createEditor(
      '<img src="https://example.com/img.png" alt="Test" />'
    );
    const json = editor.getJSON();
    const imageNode = json.content?.find((n: any) => n.type === 'image');
    expect(imageNode).toBeDefined();
    expect(imageNode?.attrs?.src).toBe('https://example.com/img.png');
    expect(imageNode?.attrs?.alt).toBe('Test');
    editor.destroy();
  });

  it('has setImage command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setImage({
      src: 'https://example.com/new.jpg',
      alt: 'New image',
    });
    const json = editor.getJSON();
    const imageNode = json.content?.find((n: any) => n.type === 'image');
    expect(imageNode).toBeDefined();
    expect(imageNode?.attrs?.src).toBe('https://example.com/new.jpg');
    editor.destroy();
  });

  it('renders img tag', () => {
    const editor = createEditor(
      '<img src="https://example.com/test.png" alt="Alt text" />'
    );
    expect(editor.getHTML()).toContain('<img');
    expect(editor.getHTML()).toContain('src="https://example.com/test.png"');
    editor.destroy();
  });
});
