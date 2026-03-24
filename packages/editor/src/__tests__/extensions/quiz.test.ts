/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubQuiz } from '../../extensions/quiz';

function createEditor(content?: string): Editor {
  return new Editor({
    extensions: [Document, Text, CommonPubText, CommonPubQuiz],
    content: content ?? '<p>Test</p>',
    element: document.createElement('div'),
  });
}

describe('CommonPubQuiz Extension', () => {
  it('creates quiz via command and verifies attributes', () => {
    const options = [
      { text: 'V = IR', correct: true },
      { text: 'V = I/R', correct: false },
    ];
    const editor = createEditor('<p>Text</p>');
    editor.commands.setQuiz({ question: "What is Ohm's law?", options });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'quiz');
    expect(node).toBeDefined();
    expect(node?.attrs?.question).toBe("What is Ohm's law?");
    expect(node?.attrs?.options).toEqual(options);
    editor.destroy();
  });

  it('defaults to empty question and options', () => {
    const editor = createEditor('<div class="cpub-quiz"></div>');
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'quiz');
    expect(node?.attrs?.question).toBe('');
    expect(node?.attrs?.options).toEqual([]);
    editor.destroy();
  });

  it('has setQuiz command', () => {
    const editor = createEditor('<p>Text</p>');
    editor.commands.setQuiz({
      question: 'What color is the sky?',
      options: [
        { text: 'Blue', correct: true },
        { text: 'Green', correct: false },
      ],
      feedback: 'Correct!',
    });
    const json = editor.getJSON();
    const node = json.content?.find((n: any) => n.type === 'quiz');
    expect(node).toBeDefined();
    expect(node?.attrs?.question).toBe('What color is the sky?');
    editor.destroy();
  });
});
