/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubToolList } from '../../extensions/toolList';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubToolList],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubToolList Extension', () => {
  it('parses tool list HTML', () => {
    const tools = [{ name: 'Soldering iron', required: true }];
    const editor = createEditor(`<div class="cpub-tool-list" data-tools='${JSON.stringify(tools)}'></div>`);
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'toolList');
    expect(node).toBeDefined();
    expect(node?.attrs?.tools).toEqual(tools);
    editor.destroy();
  });

  it('defaults tools to empty array', () => {
    const editor = createEditor('<div class="cpub-tool-list"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'toolList');
    expect(node?.attrs?.tools).toEqual([]);
    editor.destroy();
  });

  it('has setToolList command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setToolList({ tools: [{ name: 'Multimeter' }] });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'toolList');
    expect(node).toBeDefined();
    editor.destroy();
  });
});
