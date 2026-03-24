/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubCheckpoint } from '../../extensions/checkpoint';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubCheckpoint],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubCheckpoint Extension', () => {
  it('creates checkpoint via command and verifies attributes', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setCheckpoint({ message: 'Check your connections' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'checkpoint');
    expect(node).toBeDefined();
    expect(node?.attrs?.message).toBe('Check your connections');
    editor.destroy();
  });

  it('defaults message to empty string', () => {
    const editor = createEditor('<div class="cpub-checkpoint"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'checkpoint');
    expect(node?.attrs?.message).toBe('');
    editor.destroy();
  });

  it('renders with cpub-checkpoint class', () => {
    const editor = createEditor('<div class="cpub-checkpoint" data-message="Test"><span>Test</span></div>');
    expect(editor.getHTML()).toContain('cpub-checkpoint');
    editor.destroy();
  });

  it('has setCheckpoint command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setCheckpoint({ message: 'Verify power supply' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'checkpoint');
    expect(node).toBeDefined();
    expect(node?.attrs?.message).toBe('Verify power supply');
    editor.destroy();
  });
});
