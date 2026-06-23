<script setup lang="ts">
/**
 * Block-editor for a contest long-form body (overview / rules) — the house editor
 * (BlockCanvas + useBlockEditor), same as projects/blogs, adapted for contests:
 * the contest-specific `judgesShowcase` block is provided via BLOCK_COMPONENTS_KEY
 * (the editor registry is unused; resolution is override ?? builtin ?? Text), and
 * image upload is wired so image blocks work.
 *
 * Self-contained: owns its useBlockEditor, seeds from `modelValue` (or converts the
 * legacy markdown/html body), and emits `update:modelValue` as BlockTuple[] on every
 * change. Mount only once the contest has loaded (the seed is taken at setup), e.g.
 * `<ContestBodyEditor v-if="contest" ... />`.
 */
import { BlockCanvas, useBlockEditor, BLOCK_COMPONENTS_KEY, UPLOAD_HANDLER_KEY, type BlockTypeGroup } from '@commonpub/editor/vue';
import JudgesShowcaseBlock from './blocks/JudgesShowcaseBlock.vue';

const props = withDefaults(
  defineProps<{
    modelValue?: unknown[] | null;
    /** Legacy markdown/html body to seed from when there are no blocks yet. */
    legacy?: string | null;
    legacyFormat?: 'markdown' | 'html' | null;
    /** Write = block canvas; Preview = the same blocks through the view renderer
     *  (faithful to the public page); Code = read-only BlockTuple[] JSON. */
    mode?: 'write' | 'preview' | 'code';
  }>(),
  { modelValue: null, legacy: '', legacyFormat: 'markdown', mode: 'write' },
);

const emit = defineEmits<{ 'update:modelValue': [blocks: unknown[]] }>();

// Contest-specific edit block (resolved by BlockCanvas via the override map).
provide(BLOCK_COMPONENTS_KEY, { judgesShowcase: JudgesShowcaseBlock });
// Image upload for image blocks (mirrors the content editor's wiring).
const { uploadFile } = useFileUpload();
provide(UPLOAD_HANDLER_KEY, (file: File) => uploadFile<{ url: string; width?: number | null; height?: number | null }>(file, 'content'));

const blockEditor = useBlockEditor(seedBodyBlocks(props.modelValue, props.legacy, props.legacyFormat), {
  blockDefaults: { judgesShowcase: () => ({ judges: [] }) },
});

// One-way out: the editor owns its state; the parent reads changes for save/dirty.
watch(blockEditor.blocks, () => emit('update:modelValue', blockEditor.toBlockTuples()), { deep: true });

// Live blocks for Preview/Code — derived from the editor's own state (not the
// parent v-model, which only emits after the first edit) so they reflect the
// current canvas even on a freshly-loaded legacy contest.
const previewBlocks = computed<[string, Record<string, unknown>][]>(
  () => blockEditor.toBlockTuples() as [string, Record<string, unknown>][],
);
const codeJson = computed<string>(() => JSON.stringify(previewBlocks.value, null, 2));

const blockTypes: BlockTypeGroup[] = [
  {
    name: 'Basic',
    blocks: [
      { type: 'paragraph', label: 'Text', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section header' },
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or embed' },
    ],
  },
  {
    name: 'Contest',
    blocks: [
      { type: 'judgesShowcase', label: 'Judges Showcase', icon: 'fa-user-group', description: 'Avatar + bio cards for the overview' },
    ],
  },
  {
    name: 'Rich',
    blocks: [
      { type: 'callout', label: 'Tip', icon: 'fa-lightbulb', description: 'Tip callout', attrs: { variant: 'tip' } },
      { type: 'callout', label: 'Warning', icon: 'fa-triangle-exclamation', description: 'Warning callout', attrs: { variant: 'warning' } },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Blockquote' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Visual separator' },
      { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown block' },
      { type: 'embed', label: 'Embed', icon: 'fa-globe', description: 'External embed (YouTube/Vimeo etc.)' },
      { type: 'video', label: 'Video', icon: 'fa-film', description: 'Video embed' },
    ],
  },
];
</script>

<template>
  <div class="cpub-contest-body-editor">
    <!-- Canvas stays mounted (v-show) so block state + undo history survive a
         hop to Preview/Code and back. -->
    <BlockCanvas v-show="mode === 'write'" :block-editor="blockEditor" :block-types="blockTypes" />
    <div v-if="mode === 'preview'" class="cpub-cbe-preview">
      <BlocksBlockContentRenderer v-if="previewBlocks.length" :blocks="previewBlocks" class="cpub-prose cpub-md" />
      <p v-else class="cpub-cbe-empty">Nothing to preview yet. Switch to Write and add some blocks.</p>
    </div>
    <pre v-else-if="mode === 'code'" class="cpub-cbe-code" aria-label="Block content as JSON"><code>{{ codeJson }}</code></pre>
  </div>
</template>

<style scoped>
.cpub-contest-body-editor {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  padding: var(--space-2);
}
.cpub-cbe-preview { padding: var(--space-3); }
.cpub-cbe-empty { font-size: var(--text-sm); color: var(--text-faint); margin: 0; padding: var(--space-4) 0; text-align: center; }
.cpub-cbe-code {
  margin: 0; padding: var(--space-3); overflow: auto; max-height: 60vh;
  background: var(--surface2); color: var(--text-dim);
  font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.6;
  white-space: pre; tab-size: 2;
}
</style>
