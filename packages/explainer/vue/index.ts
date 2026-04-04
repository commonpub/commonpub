// Main components
export { default as ExplainerViewer } from './components/ExplainerViewer.vue';
export { default as ExplainerEditor } from './components/ExplainerEditor.vue';
export { default as BlockRenderer } from './components/BlockRenderer.vue';

// Editor sub-components
export { default as BlockCanvas } from './components/editor/BlockCanvas.vue';
export { default as EditorBlockLibrary } from './components/editor/EditorBlockLibrary.vue';
export { default as EditorSection } from './components/editor/EditorSection.vue';
export { default as EditorTagInput } from './components/editor/EditorTagInput.vue';

// Block components (for individual use / custom renderers)
export {
  QuizBlock,
  SliderBlock,
  CheckpointBlock,
  SectionHeader,
  TextBlock,
  HeadingBlock,
  CodeBlock,
  ImageBlock,
  CalloutBlock,
  QuoteBlock,
  DividerBlock,
  EmbedBlock,
} from './components/blocks/index.js';

// Composables
export { useBlockEditor } from './composables/useBlockEditor.js';
export { useExplainerSections } from './composables/useExplainerSections.js';
export { useExplainerProgress } from './composables/useExplainerProgress.js';

// Types
export type { ExplainerContent } from './components/ExplainerViewer.vue';
export type { BlockEditor, EditorBlock } from './composables/useBlockEditor.js';
export type { BlockTypeGroup, BlockDef } from './components/editor/EditorBlockLibrary.vue';
