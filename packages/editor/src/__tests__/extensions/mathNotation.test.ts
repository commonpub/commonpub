/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubMathNotation } from '../../extensions/mathNotation';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubMathNotation],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubMathNotation Extension', () => {
  it('creates math notation via command and verifies attributes', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setMathNotation({ expression: 'E = mc^2', display: true });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'mathNotation');
    expect(node).toBeDefined();
    expect(node?.attrs?.expression).toBe('E = mc^2');
    expect(node?.attrs?.display).toBe(true);
    editor.destroy();
  });

  it('defaults to inline (display: false) via command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setMathNotation({ expression: 'x = 5' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'mathNotation');
    expect(node?.attrs?.display).toBe(false);
    editor.destroy();
  });

  it('defaults to inline (display: false)', () => {
    const editor = createEditor('<div class="cpub-math"><code>a + b</code></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'mathNotation');
    expect(node?.attrs?.display).toBe(false);
    editor.destroy();
  });

  it('renders with cpub-math class', () => {
    const editor = createEditor('<div class="cpub-math cpub-math-display"><code>f(x)</code></div>');
    expect(editor.getHTML()).toContain('cpub-math');
    editor.destroy();
  });

  it('has setMathNotation command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setMathNotation({ expression: 'V = IR', display: true });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'mathNotation');
    expect(node).toBeDefined();
    expect(node?.attrs?.expression).toBe('V = IR');
    expect(node?.attrs?.display).toBe(true);
    editor.destroy();
  });
});
