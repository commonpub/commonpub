/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubCallout } from '../../extensions/callout';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubCallout],
    content: content ?? '<div class="callout callout-info"><p>Note</p></div>',
    element: document.createElement('div'),
  });
}

describe('CommonPubCallout Extension', () => {
  it('parses callout HTML', () => {
    const editor = createEditor();
    const json = editor.getJSON();
    const calloutNode = json.content?.find((n: any) => n.type === 'callout');
    expect(calloutNode).toBeDefined();
    expect(calloutNode?.attrs?.variant).toBe('info');
    editor.destroy();
  });

  it('supports all variants', () => {
    for (const variant of ['info', 'tip', 'warning', 'danger']) {
      const editor = createEditor(`<div class="callout callout-${variant}"><p>Test</p></div>`);
      const json = editor.getJSON();
      const calloutNode = json.content?.find((n: any) => n.type === 'callout');
      expect(calloutNode?.attrs?.variant).toBe(variant);
      editor.destroy();
    }
  });

  it('renders with variant class', () => {
    const editor = createEditor('<div class="callout callout-warning"><p>Warning text</p></div>');
    expect(editor.getHTML()).toContain('callout-warning');
    editor.destroy();
  });

  it('has setCallout command', () => {
    const editor = createEditor('<p>Important</p>');
    editor.commands.selectAll();
    editor.commands.setCallout({ variant: 'danger' });
    const json = editor.getJSON();
    const calloutNode = json.content?.find((n: any) => n.type === 'callout');
    expect(calloutNode).toBeDefined();
    expect(calloutNode?.attrs?.variant).toBe('danger');
    editor.destroy();
  });
});
