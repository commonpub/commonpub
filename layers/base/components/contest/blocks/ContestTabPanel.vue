<script setup lang="ts">
/**
 * One editable tab panel for the `tabs` block: a nested BlockCanvas over its own
 * useBlockEditor, seeded from the panel's BlockTuple[]. Emits the panel's blocks
 * up on every change (watching a getter of .value so structural inserts are caught
 * — a bare readonly-ref watch misses push/splice). Mounted one-at-a-time by the
 * parent (keyed by tab) so each tab gets a clean editor; the parent's content is
 * the source of truth across tab switches. Inherits BLOCK_COMPONENTS_KEY +
 * UPLOAD_HANDLER_KEY from the contest editor, so table/criteriaBar/html/image all
 * edit here too. The `groups` passed in exclude container blocks (no tabs-in-tabs).
 */
import { BlockCanvas, useBlockEditor, type BlockTypeGroup } from '@commonpub/editor/vue';
import type { BlockTuple } from '@commonpub/editor';

const props = defineProps<{
  blocks: BlockTuple[];
  groups: BlockTypeGroup[];
}>();
const emit = defineEmits<{ 'update:blocks': [blocks: BlockTuple[]] }>();

const editor = useBlockEditor(Array.isArray(props.blocks) ? props.blocks : []);
watch(() => editor.blocks.value, () => emit('update:blocks', editor.toBlockTuples()), { deep: true });
</script>

<template>
  <BlockCanvas :block-editor="editor" :block-types="groups" />
</template>
