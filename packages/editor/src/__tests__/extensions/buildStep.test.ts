/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubBuildStep } from '../../extensions/buildStep';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubBuildStep],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubBuildStep Extension', () => {
  it('creates build step via command and verifies attributes', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setBuildStep({ stepNumber: 3, instructions: 'Solder the LED' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'buildStep');
    expect(node).toBeDefined();
    expect(node?.attrs?.stepNumber).toBe(3);
    expect(node?.attrs?.instructions).toBe('Solder the LED');
    editor.destroy();
  });

  it('has default attribute values', () => {
    const editor = createEditor('<div class="cpub-build-step"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'buildStep');
    expect(node?.attrs?.stepNumber).toBe(1);
    expect(node?.attrs?.instructions).toBe('');
    expect(node?.attrs?.image).toBeNull();
    expect(node?.attrs?.time).toBeNull();
    editor.destroy();
  });

  it('has setBuildStep command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setBuildStep({ stepNumber: 2, instructions: 'Wire the circuit', time: '15 min' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'buildStep');
    expect(node).toBeDefined();
    expect(node?.attrs?.stepNumber).toBe(2);
    editor.destroy();
  });
});
