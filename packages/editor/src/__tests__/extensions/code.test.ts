import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubCodeBlock } from '../../extensions/code';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubCodeBlock],
    content: content ?? '<pre><code>const x = 1;</code></pre>',
    element: document.createElement('div'),
  });
}

describe('CommonPubCodeBlock Extension', () => {
  it('parses code block HTML', () => {
    const editor = createEditor();
    expect(editor.getText()).toContain('const x = 1;');
    editor.destroy();
  });

  it('renders pre > code structure', () => {
    const editor = createEditor('<pre><code>hello</code></pre>');
    expect(editor.getHTML()).toContain('<pre');
    expect(editor.getHTML()).toContain('<code>');
    editor.destroy();
  });

  it('stores language attribute', () => {
    const editor = createEditor('<pre><code class="language-typescript">let x = 1;</code></pre>');
    const json = editor.getJSON();
    const codeNode = json.content?.find((n: any) => n.type === 'code_block');
    expect(codeNode?.attrs?.language).toBe('typescript');
    editor.destroy();
  });

  it('has setCodeBlock command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setCodeBlock({ language: 'rust' });
    const json = editor.getJSON();
    const codeNode = json.content?.find((n: any) => n.type === 'code_block');
    expect(codeNode).toBeDefined();
    expect(codeNode?.attrs?.language).toBe('rust');
    editor.destroy();
  });
});
