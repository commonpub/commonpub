/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubInteractiveSlider } from '../../extensions/interactiveSlider';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubInteractiveSlider],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubInteractiveSlider Extension', () => {
  it('creates slider via command and verifies attributes', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setInteractiveSlider({
      label: 'Voltage', min: 0, max: 12, step: 0.1, defaultValue: 5, states: [],
    });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'interactiveSlider');
    expect(node).toBeDefined();
    expect(node?.attrs?.label).toBe('Voltage');
    expect(node?.attrs?.min).toBe(0);
    expect(node?.attrs?.max).toBe(12);
    expect(node?.attrs?.step).toBe(0.1);
    expect(node?.attrs?.defaultValue).toBe(5);
    editor.destroy();
  });

  it('has correct default values', () => {
    const editor = createEditor('<div class="cpub-interactive-slider"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'interactiveSlider');
    expect(node?.attrs?.label).toBe('');
    expect(node?.attrs?.min).toBe(0);
    expect(node?.attrs?.max).toBe(100);
    expect(node?.attrs?.step).toBe(1);
    expect(node?.attrs?.defaultValue).toBe(50);
    editor.destroy();
  });

  it('has setInteractiveSlider command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setInteractiveSlider({
      label: 'Resistance',
      min: 0,
      max: 1000,
      step: 10,
      defaultValue: 100,
      states: [{ range: [0, 500], label: 'Low' }],
    });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'interactiveSlider');
    expect(node).toBeDefined();
    expect(node?.attrs?.label).toBe('Resistance');
    editor.destroy();
  });
});
