/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubGallery } from '../../extensions/gallery';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubGallery],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubGallery Extension', () => {
  it('parses gallery HTML with images data', () => {
    const images = [{ src: 'a.jpg', alt: 'A' }];
    const editor = createEditor(`<div class="cpub-gallery" data-images='${JSON.stringify(images)}'></div>`);
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'gallery');
    expect(node).toBeDefined();
    expect(node?.attrs?.images).toEqual(images);
    editor.destroy();
  });

  it('defaults images to empty array', () => {
    const editor = createEditor('<div class="cpub-gallery"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'gallery');
    expect(node?.attrs?.images).toEqual([]);
    editor.destroy();
  });

  it('renders with cpub-gallery class', () => {
    const images = [{ src: 'b.jpg', alt: 'B', caption: 'Photo B' }];
    const editor = createEditor(`<div class="cpub-gallery" data-images='${JSON.stringify(images)}'></div>`);
    expect(editor.getHTML()).toContain('cpub-gallery');
    editor.destroy();
  });

  it('has setGallery command', () => {
    const editor = createEditor('<p>Replace me</p>');
    editor.commands.setGallery({ images: [{ src: 'x.jpg', alt: 'X' }] });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'gallery');
    expect(node).toBeDefined();
    editor.destroy();
  });
});
