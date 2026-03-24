/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubMarkdown } from '../../extensions/markdown';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubMarkdown],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubMarkdown Extension', () => {
  it('creates markdown via command and verifies attributes', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setMarkdown({ source: '# Hello World' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'markdown');
    expect(node).toBeDefined();
    expect(node?.attrs?.source).toBe('# Hello World');
    editor.destroy();
  });

  it('defaults source to empty string', () => {
    const editor = createEditor('<div class="cpub-markdown"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'markdown');
    expect(node?.attrs?.source).toBe('');
    editor.destroy();
  });

  it('renders with cpub-markdown class', () => {
    const editor = createEditor('<div class="cpub-markdown"><pre>content</pre></div>');
    expect(editor.getHTML()).toContain('cpub-markdown');
    editor.destroy();
  });

  it('has setMarkdown command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setMarkdown({ source: '## Section' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'markdown');
    expect(node).toBeDefined();
    expect(node?.attrs?.source).toBe('## Section');
    editor.destroy();
  });
});
