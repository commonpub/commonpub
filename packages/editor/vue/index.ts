// @commonpub/editor/vue — Vue 3 block editor components and composables
//
// Usage:
//   import { BlockCanvas, BlockPicker, useBlockEditor } from '@commonpub/editor/vue';
//   import type { EditorBlock, BlockEditor } from '@commonpub/editor/vue';

// --- Composables ---
export { useBlockEditor } from './composables/useBlockEditor.js';
export type { BlockEditor } from './composables/useBlockEditor.js';

// --- Infrastructure components ---
export { default as BlockCanvas } from './components/BlockCanvas.vue';
export { default as BlockWrapper } from './components/BlockWrapper.vue';
export { default as BlockPicker } from './components/BlockPicker.vue';
export { default as BlockInsertZone } from './components/BlockInsertZone.vue';
export { default as EditorBlocks } from './components/EditorBlocks.vue';
export { default as EditorSection } from './components/EditorSection.vue';
export { default as EditorShell } from './components/EditorShell.vue';
export { default as EditorTagInput } from './components/EditorTagInput.vue';
export { default as EditorVisibility } from './components/EditorVisibility.vue';

// --- Block components ---
export { default as TextBlock } from './components/blocks/TextBlock.vue';
export { default as HeadingBlock } from './components/blocks/HeadingBlock.vue';
export { default as CodeBlock } from './components/blocks/CodeBlock.vue';
export { default as ImageBlock } from './components/blocks/ImageBlock.vue';
export { default as QuoteBlock } from './components/blocks/QuoteBlock.vue';
export { default as CalloutBlock } from './components/blocks/CalloutBlock.vue';
export { default as DividerBlock } from './components/blocks/DividerBlock.vue';
export { default as VideoBlock } from './components/blocks/VideoBlock.vue';
export { default as EmbedBlock } from './components/blocks/EmbedBlock.vue';
export { default as GalleryBlock } from './components/blocks/GalleryBlock.vue';
export { default as MarkdownBlock } from './components/blocks/MarkdownBlock.vue';
export { default as MathBlock } from './components/blocks/MathBlock.vue';
export { default as PartsListBlock } from './components/blocks/PartsListBlock.vue';
export { default as BuildStepBlock } from './components/blocks/BuildStepBlock.vue';
export { default as ToolListBlock } from './components/blocks/ToolListBlock.vue';
export { default as DownloadsBlock } from './components/blocks/DownloadsBlock.vue';
export { default as QuizBlock } from './components/blocks/QuizBlock.vue';
export { default as SliderBlock } from './components/blocks/SliderBlock.vue';
export { default as CheckpointBlock } from './components/blocks/CheckpointBlock.vue';
export { default as SectionHeaderBlock } from './components/blocks/SectionHeaderBlock.vue';

// --- Provide/inject keys ---
export { BLOCK_COMPONENTS_KEY, UPLOAD_HANDLER_KEY, SEARCH_PRODUCTS_KEY } from './provide.js';
export type { BlockComponentMap } from './provide.js';

// --- Types ---
export type {
  EditorBlock,
  BlockEditorOptions,
  BlockTypeDef,
  BlockTypeGroup,
  BlockDef,
  BlockGroup,
} from './types.js';

// --- Utilities ---
export { sanitizeBlockHtml } from './utils.js';
