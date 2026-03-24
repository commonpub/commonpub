/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubVideo } from '../../extensions/video';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubVideo],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubVideo Extension', () => {
  it('parses video HTML', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setVideo({ url: 'https://youtube.com/watch?v=abc', platform: 'youtube' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'video');
    expect(node).toBeDefined();
    expect(node?.attrs?.url).toBe('https://youtube.com/watch?v=abc');
    expect(node?.attrs?.platform).toBe('youtube');
    editor.destroy();
  });

  it('defaults platform to other', () => {
    const editor = createEditor('<div class="cpub-video"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'video');
    expect(node?.attrs?.platform).toBe('other');
    editor.destroy();
  });

  it('renders with cpub-video class', () => {
    const editor = createEditor('<div class="cpub-video" data-url="https://example.com/vid" data-platform="vimeo"></div>');
    expect(editor.getHTML()).toContain('cpub-video');
    editor.destroy();
  });

  it('has setVideo command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setVideo({ url: 'https://youtube.com/watch?v=123', platform: 'youtube', caption: 'Demo' });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'video');
    expect(node).toBeDefined();
    expect(node?.attrs?.caption).toBe('Demo');
    editor.destroy();
  });
});
