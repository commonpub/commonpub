/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubDownloads } from '../../extensions/downloads';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubDownloads],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubDownloads Extension', () => {
  it('parses downloads HTML', () => {
    const files = [{ name: 'schematic.pdf', url: '/files/schematic.pdf', size: '2.5MB' }];
    const editor = createEditor(`<div class="cpub-downloads" data-files='${JSON.stringify(files)}'></div>`);
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'downloads');
    expect(node).toBeDefined();
    expect(node?.attrs?.files).toEqual(files);
    editor.destroy();
  });

  it('defaults files to empty array', () => {
    const editor = createEditor('<div class="cpub-downloads"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'downloads');
    expect(node?.attrs?.files).toEqual([]);
    editor.destroy();
  });

  it('has setDownloads command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setDownloads({ files: [{ name: 'gerber.zip', url: '/files/gerber.zip' }] });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'downloads');
    expect(node).toBeDefined();
    editor.destroy();
  });
});
