/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubEmbed } from '../../extensions/embed';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubEmbed],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubEmbed Extension', () => {
  it('creates embed via command and verifies attributes', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setEmbed({ url: 'https://codepen.io/abc', type: 'codepen' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'embed');
    expect(node).toBeDefined();
    expect(node?.attrs?.url).toBe('https://codepen.io/abc');
    expect(node?.attrs?.type).toBe('codepen');
    editor.destroy();
  });

  it('defaults type to generic', () => {
    const editor = createEditor('<div class="cpub-embed"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'embed');
    expect(node?.attrs?.type).toBe('generic');
    editor.destroy();
  });

  it('has setEmbed command', () => {
    const editor = createEditor('<p>Replace</p>');
    editor.commands.setEmbed({ url: 'https://gist.github.com/123', type: 'gist' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'embed');
    expect(node).toBeDefined();
    editor.destroy();
  });
});
