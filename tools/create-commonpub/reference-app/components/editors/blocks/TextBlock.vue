<script setup lang="ts">
/**
 * Text/paragraph block — inline TipTap editor for rich text.
 * Supports bold, italic, code, strike, link, lists.
 * Detects "/" at start of empty block to trigger slash command menu.
 */
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Bold } from '@tiptap/extension-bold';
import { Italic } from '@tiptap/extension-italic';
import { Code } from '@tiptap/extension-code';
import { Strike } from '@tiptap/extension-strike';
import { Link } from '@tiptap/extension-link';
import { History } from '@tiptap/extension-history';
import { Placeholder } from '@tiptap/extension-placeholder';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { Extension } from '@tiptap/core';

const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
  'slash-command': [];
  'selection-change': [hasSelection: boolean, rect: DOMRect | null];
  'enter-at-end': [];
  'backspace-empty': [];
}>();

const editorEl = ref<HTMLElement | null>(null);
let editor: Editor | null = null;

onMounted(() => {
  if (!editorEl.value) return;

  editor = new Editor({
    element: editorEl.value,
    extensions: [
      Document,
      Text,
      Paragraph,
      Bold,
      Italic,
      Code,
      Strike,
      Link.configure({ openOnClick: false }),
      History,
      BulletList,
      OrderedList,
      ListItem,
      Placeholder.configure({ placeholder: 'Type / for commands...' }),
      Extension.create({
        name: 'blockKeyboard',
        addKeyboardShortcuts() {
          return {
            'Enter': ({ editor: e }) => {
              // If cursor is at the very end of the document and last node is an empty paragraph, create new block
              const { state } = e;
              const { $from } = state.selection;
              const atEnd = $from.pos === state.doc.content.size - 1;
              const isEmpty = state.doc.textContent.length === 0;
              const lastNode = state.doc.lastChild;
              const lastIsEmptyP = lastNode?.type.name === 'paragraph' && lastNode.textContent === '';

              // If we're at end and the text has content, emit to create a new block below
              if (atEnd && !isEmpty) {
                emit('enter-at-end');
                return true;
              }
              return false;
            },
            'Backspace': ({ editor: e }) => {
              // If block is completely empty, emit to delete this block
              if (e.isEmpty) {
                emit('backspace-empty');
                return true;
              }
              return false;
            },
          };
        },
      }),
    ],
    content: (props.content.html as string) || '',
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const text = e.getText();

      // Detect slash command: "/" typed at start of otherwise-empty block
      if (text === '/') {
        // Clear the slash character and trigger command menu
        e.commands.clearContent(true);
        emit('slash-command');
        return;
      }

      emit('update', { html });
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to } = e.state.selection;
      const hasSelection = from !== to;

      if (hasSelection) {
        // Get the bounding rect of the selection for floating toolbar positioning
        const view = e.view;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        const rect = new DOMRect(
          Math.min(start.left, end.left),
          start.top,
          Math.abs(end.right - start.left),
          end.bottom - start.top,
        );
        emit('selection-change', true, rect);
      } else {
        emit('selection-change', false, null);
      }
    },
  });
});

onUnmounted(() => {
  editor?.destroy();
});

// Sync external content changes (e.g. undo at the block level)
watch(() => props.content.html, (newHtml) => {
  if (editor && newHtml !== editor.getHTML()) {
    editor.commands.setContent((newHtml as string) || '', false);
  }
});

/** Expose the TipTap editor instance for the floating toolbar */
function getEditor(): Editor | null {
  return editor;
}

defineExpose({ getEditor });
</script>

<template>
  <div ref="editorEl" class="cpub-text-block" />
</template>

<style scoped>
.cpub-text-block {
  font-size: 15px;
  line-height: 1.75;
  color: var(--text);
  min-height: 1.75em;
}

.cpub-text-block :deep(.tiptap) {
  outline: none;
  min-height: 1.75em;
}

.cpub-text-block :deep(.tiptap p) {
  margin-bottom: 0.5em;
}

.cpub-text-block :deep(.tiptap p:last-child) {
  margin-bottom: 0;
}

.cpub-text-block :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--text-faint);
  pointer-events: none;
  float: left;
  height: 0;
}

.cpub-text-block :deep(.tiptap strong) {
  font-weight: 600;
}

.cpub-text-block :deep(.tiptap code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 1px 4px;
  background: var(--surface3);
  border: 1px solid var(--border2);
}

.cpub-text-block :deep(.tiptap a) {
  color: var(--accent);
  text-decoration: underline;
}

.cpub-text-block :deep(.tiptap ul),
.cpub-text-block :deep(.tiptap ol) {
  padding-left: 1.5em;
  margin-bottom: 0.5em;
}
</style>
