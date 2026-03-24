/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubHeading } from '../../extensions/heading';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubHeading],
    content: content ?? '<h2>Title</h2><p>Body</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubHeading Extension', () => {
  it('parses heading HTML', () => {
    const editor = createEditor('<h1>Big Title</h1>');
    expect(editor.getHTML()).toContain('<h1>Big Title</h1>');
    editor.destroy();
  });

  it('supports levels 1-4', () => {
    for (const level of [1, 2, 3, 4]) {
      const editor = createEditor(`<h${level}>Level ${level}</h${level}>`);
      expect(editor.getHTML()).toContain(`<h${level}>`);
      editor.destroy();
    }
  });

  it('renders heading with correct level', () => {
    const editor = createEditor('<h3>Sub heading</h3>');
    const json = editor.getJSON();
    const headingNode = json.content?.find((n: any) => n.type === 'heading');
    expect(headingNode?.attrs?.level).toBe(3);
    editor.destroy();
  });

  it('has setHeading command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setHeading({ level: 2 });
    expect(editor.getHTML()).toContain('<h2>');
    editor.destroy();
  });
});
