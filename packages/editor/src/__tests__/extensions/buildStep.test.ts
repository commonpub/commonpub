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
    editor.commands.setBuildStep({ stepNumber: 3, title: 'Solder the LED' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'buildStep');
    expect(node).toBeDefined();
    expect(node?.attrs?.stepNumber).toBe(3);
    expect(node?.attrs?.title).toBe('Solder the LED');
    editor.destroy();
  });

  it('has default attribute values', () => {
    const editor = createEditor('<div class="cpub-build-step"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'buildStep');
    expect(node?.attrs?.stepNumber).toBe(1);
    expect(node?.attrs?.title).toBe('');
    expect(node?.attrs?.children).toEqual([]);
    expect(node?.attrs?.time).toBeNull();
    editor.destroy();
  });

  it('has setBuildStep command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setBuildStep({ stepNumber: 2, title: 'Wire the circuit', time: '15 min' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'buildStep');
    expect(node).toBeDefined();
    expect(node?.attrs?.stepNumber).toBe(2);
    expect(node?.attrs?.time).toBe('15 min');
    editor.destroy();
  });

  it('preserves legacy attributes for migration', () => {
    const editor = createEditor('<p>Text</p>');
    // Legacy attributes still stored on the node for backward compat
    const json = editor.getJSON();
    const buildStepNode = { type: 'buildStep', attrs: { stepNumber: 1, instructions: 'Old format', image: 'https://example.com/img.jpg' } };
    editor.commands.setContent({ type: 'doc', content: [buildStepNode] });
    const result = editor.getJSON();
    const node = result.content?.find((n: any) => n.type === 'buildStep');
    expect(node?.attrs?.instructions).toBe('Old format');
    expect(node?.attrs?.image).toBe('https://example.com/img.jpg');
    editor.destroy();
  });
});
