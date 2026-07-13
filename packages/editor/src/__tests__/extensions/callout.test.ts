/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { createApp, h, reactive, nextTick } from 'vue';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { CommonPubText } from '../../extensions/text';
import { CommonPubCallout } from '../../extensions/callout';
import CalloutBlock from '../../../vue/components/blocks/CalloutBlock.vue';

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

describe('CalloutBlock body editing (caret / reversal regression)', () => {
  /**
   * Mount CalloutBlock inside a parent that echoes the emitted `content` straight
   * back into the `content` prop on every keystroke — exactly what BlockCanvas
   * does. This is the round-trip that, with the old `v-html`-bound body, re-set
   * `innerHTML` on each input, destroyed the caret's text node, and reversed the
   * typed string character by character ("make" -> "ekam").
   */
  function mountBlock(): {
    editable: HTMLElement;
    state: { html: string; variant: string };
    teardown: () => void;
  } {
    const state = reactive<{ html: string; variant: string }>({ html: '', variant: 'info' });
    const host = document.createElement('div');
    document.body.appendChild(host);

    const app = createApp({
      render() {
        return h(CalloutBlock, {
          content: { html: state.html, variant: state.variant },
          onUpdate: (content: Record<string, unknown>) => {
            state.html = content.html as string;
            state.variant = content.variant as string;
          },
        });
      },
    });
    app.mount(host);

    const editable = host.querySelector('.cpub-callout-text') as HTMLElement;
    return {
      editable,
      state,
      teardown: () => {
        app.unmount();
        host.remove();
      },
    };
  }

  it('does not reverse text typed one character at a time', async () => {
    const { editable, state, teardown } = mountBlock();
    await nextTick();

    const target = 'make sure to do this';
    let typed = '';

    for (const ch of target) {
      // A real contenteditable inserts the char at the caret: the DOM now holds
      // the forward string. Simulate that, then fire `input` and let the parent
      // round-trip the value back into the `content` prop.
      typed += ch;
      editable.textContent = typed;
      const nodeBeforeRoundTrip = editable.firstChild;

      editable.dispatchEvent(new Event('input'));
      await nextTick();

      // The block MUST NOT rewrite its own editable in response to the echoed
      // value: doing so (the old bug) replaces the text node and collapses the
      // caret to offset 0, which is what reversed the input in the browser.
      expect(editable.firstChild).toBe(nodeBeforeRoundTrip);
      // Text stays forward, never reversed.
      expect(editable.textContent).toBe(typed);
    }

    // The content that flowed out to the parent is the string in order.
    expect(state.html).toBe(target);
    expect(editable.textContent).toBe(target);

    teardown();
  });

  it('still syncs genuine external content changes into the body', async () => {
    const { editable, state, teardown } = mountBlock();
    await nextTick();

    // An external update (e.g. block-level undo / programmatic set) must reach
    // the DOM, since it differs from what the body currently holds.
    state.html = '<strong>external</strong>';
    await nextTick();

    expect(editable.innerHTML).toBe('<strong>external</strong>');

    teardown();
  });
});
