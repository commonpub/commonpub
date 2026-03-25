<script setup lang="ts">
import { createCommonPubEditor, docToBlockTuples } from '@commonpub/editor';
import type { BlockTuple } from '@commonpub/editor';
import type { Editor } from '@tiptap/core';

const props = withDefaults(defineProps<{
  modelValue: BlockTuple[];
  editable?: boolean;
  placeholder?: string;
  blockTypes?: string[];
}>(), {
  editable: true,
  placeholder: 'Start writing...',
  blockTypes: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [blocks: BlockTuple[]];
  selectionChange: [node: { type: string; attrs: Record<string, unknown> } | null];
}>();

const editorElement = ref<HTMLElement | null>(null);
const editor = ref<Editor | null>(null);

onMounted(() => {
  if (!editorElement.value) return;

  editor.value = createCommonPubEditor({
    content: props.modelValue.length > 0 ? props.modelValue : undefined,
    editable: props.editable,
    placeholder: props.placeholder,
    element: editorElement.value,
    onUpdate: (blocks: BlockTuple[]) => {
      emit('update:modelValue', blocks);
    },
  });

  editor.value.on('selectionUpdate', ({ editor: e }) => {
    const { $anchor } = e.state.selection;
    const node = $anchor.parent;
    if (node && node.type.name !== 'doc') {
      emit('selectionChange', { type: node.type.name, attrs: { ...node.attrs } });
    } else {
      emit('selectionChange', null);
    }
  });
});

watch(() => props.editable, (val) => {
  editor.value?.setEditable(val);
});

onBeforeUnmount(() => {
  editor.value?.destroy();
  editor.value = null;
});

defineExpose({ editor });
</script>

<template>
  <div ref="editorElement" class="cpub-editor cpub-prose" />
</template>

<style scoped>
.cpub-editor {
  min-height: 300px;
  outline: none;
}

.cpub-editor :deep(.tiptap) {
  outline: none;
  min-height: 300px;
}

.cpub-editor :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-faint);
  pointer-events: none;
  height: 0;
}

.cpub-editor :deep(.tiptap:focus) {
  outline: none;
}
</style>
