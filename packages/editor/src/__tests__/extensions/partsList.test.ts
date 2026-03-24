/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubPartsList } from '../../extensions/partsList';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubPartsList],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubPartsList Extension', () => {
  it('parses parts list HTML with data', () => {
    const parts = [{ name: 'Resistor', qty: 10, price: 0.5 }];
    const editor = createEditor(`<div class="cpub-parts-list" data-parts='${JSON.stringify(parts)}'></div>`);
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'partsList');
    expect(node).toBeDefined();
    expect(node?.attrs?.parts).toEqual(parts);
    editor.destroy();
  });

  it('defaults parts to empty array', () => {
    const editor = createEditor('<div class="cpub-parts-list"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'partsList');
    expect(node?.attrs?.parts).toEqual([]);
    editor.destroy();
  });

  it('has setPartsList command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setPartsList({ parts: [{ name: 'LED', qty: 5, required: true }] });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'partsList');
    expect(node).toBeDefined();
    editor.destroy();
  });
});
