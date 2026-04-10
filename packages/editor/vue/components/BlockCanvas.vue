<script setup lang="ts">
/**
 * BlockCanvas — the main editor canvas that renders a block array
 * with wrappers, insert zones, and a block picker.
 *
 * Supports:
 * - Insert zones between blocks (click to open picker)
 * - Slash command (/ in empty text block) opens picker inline
 * - Drag-and-drop reordering via BlockWrapper
 * - Floating text toolbar on selection (delegated to FloatingToolbar)
 */
import { ref, inject, onMounted, onUnmounted, type Component } from 'vue';
import type { EditorBlock, BlockTypeGroup } from '../types.js';
import type { BlockEditor } from '../composables/useBlockEditor.js';
import { BLOCK_COMPONENTS_KEY, UPLOAD_HANDLER_KEY, SEARCH_PRODUCTS_KEY } from '../provide.js';

import BlockWrapper from './BlockWrapper.vue';
import BlockPicker from './BlockPicker.vue';
import BlockInsertZone from './BlockInsertZone.vue';

// Block components — static import map
import TextBlock from './blocks/TextBlock.vue';
import HeadingBlock from './blocks/HeadingBlock.vue';
import CodeBlock from './blocks/CodeBlock.vue';
import ImageBlock from './blocks/ImageBlock.vue';
import QuoteBlock from './blocks/QuoteBlock.vue';
import CalloutBlock from './blocks/CalloutBlock.vue';
import DividerBlock from './blocks/DividerBlock.vue';
import VideoBlock from './blocks/VideoBlock.vue';
import EmbedBlock from './blocks/EmbedBlock.vue';
import GalleryBlock from './blocks/GalleryBlock.vue';
import PartsListBlock from './blocks/PartsListBlock.vue';
import BuildStepBlock from './blocks/BuildStepBlock.vue';
import ToolListBlock from './blocks/ToolListBlock.vue';
import DownloadsBlock from './blocks/DownloadsBlock.vue';
import QuizBlock from './blocks/QuizBlock.vue';
import SliderBlock from './blocks/SliderBlock.vue';
import CheckpointBlock from './blocks/CheckpointBlock.vue';
import MathBlock from './blocks/MathBlock.vue';
import SectionHeaderBlock from './blocks/SectionHeaderBlock.vue';
import MarkdownBlock from './blocks/MarkdownBlock.vue';

const BLOCK_COMPONENTS: Record<string, Component> = {
  paragraph: TextBlock,
  text: TextBlock,
  heading: HeadingBlock,
  code: CodeBlock,
  code_block: CodeBlock,
  codeBlock: CodeBlock,
  image: ImageBlock,
  gallery: GalleryBlock,
  quote: QuoteBlock,
  blockquote: QuoteBlock,
  callout: CalloutBlock,
  divider: DividerBlock,
  horizontal_rule: DividerBlock,
  horizontalRule: DividerBlock,
  video: VideoBlock,
  embed: EmbedBlock,
  partsList: PartsListBlock,
  buildStep: BuildStepBlock,
  toolList: ToolListBlock,
  downloads: DownloadsBlock,
  quiz: QuizBlock,
  interactiveSlider: SliderBlock,
  slider: SliderBlock,
  checkpoint: CheckpointBlock,
  mathNotation: MathBlock,
  math: MathBlock,
  bulletList: TextBlock,
  orderedList: TextBlock,
  sectionHeader: SectionHeaderBlock,
  markdown: MarkdownBlock,
};

const props = defineProps<{
  blockEditor: BlockEditor;
  blockTypes: BlockTypeGroup[];
  /** Upload handler passed through to ImageBlock/GalleryBlock */
  onUpload?: (file: File) => Promise<{ url: string; width?: number | null; height?: number | null }>;
  /** Product search handler passed through to PartsListBlock */
  onSearchProducts?: (query: string) => Promise<Array<{ id: string; name: string; slug: string; description: string | null; category: string | null; imageUrl: string | null; purchaseUrl: string | null }>>;
}>();

// --- Provide/inject overrides ---
const componentOverrides = inject(BLOCK_COMPONENTS_KEY, {});
const injectedUpload = inject(UPLOAD_HANDLER_KEY, undefined);
const injectedSearch = inject(SEARCH_PRODUCTS_KEY, undefined);

/** Resolved upload handler — prop takes priority over injected */
const resolvedUpload = props.onUpload ?? injectedUpload;
const resolvedSearch = props.onSearchProducts ?? injectedSearch;

// --- Block picker state ---
const pickerVisible = ref(false);
const pickerInsertIndex = ref(0);
/** When non-null, slash command is replacing this block instead of inserting */
const slashCommandBlockId = ref<string | null>(null);

function openPicker(atIndex: number): void {
  slashCommandBlockId.value = null;
  pickerInsertIndex.value = atIndex;
  pickerVisible.value = true;
}

function openSlashPicker(block: EditorBlock): void {
  const idx = props.blockEditor.getBlockIndex(block.id);
  if (idx === -1) return;
  slashCommandBlockId.value = block.id;
  pickerInsertIndex.value = idx;
  pickerVisible.value = true;
}

function closePicker(): void {
  pickerVisible.value = false;
  slashCommandBlockId.value = null;
}

function onPickerSelect(type: string, attrs?: Record<string, unknown>): void {
  if (slashCommandBlockId.value) {
    // Only replace if the block is empty — otherwise insert below to preserve content
    const block = props.blockEditor.blocks.value.find((b) => b.id === slashCommandBlockId.value);
    const html = (block?.content?.html as string) ?? '';
    const isEmpty = !html.replace(/<[^>]*>/g, '').trim();
    if (isEmpty) {
      props.blockEditor.replaceBlock(slashCommandBlockId.value, type, attrs);
    } else {
      const idx = props.blockEditor.getBlockIndex(slashCommandBlockId.value);
      props.blockEditor.addBlock(type, attrs, idx + 1);
    }
  } else {
    props.blockEditor.addBlock(type, attrs, pickerInsertIndex.value);
  }
  closePicker();
}

// --- Floating toolbar state ---
const floatingToolbar = ref<{
  visible: boolean;
  top: number;
  left: number;
  blockId: string;
  activeMarks: { bold: boolean; italic: boolean; strike: boolean; code: boolean; link: boolean };
}>({ visible: false, top: 0, left: 0, blockId: '', activeMarks: { bold: false, italic: false, strike: false, code: false, link: false } });

function onSelectionChange(block: EditorBlock, hasSelection: boolean, rect: DOMRect | null): void {
  if (hasSelection && rect) {
    const toolbarWidth = 180;
    const toolbarHeight = 44;
    const rawTop = rect.top - toolbarHeight;
    const rawLeft = rect.left + rect.width / 2;
    // Query active marks from the TipTap editor
    const editor = getActiveEditorForBlock(block.id);
    const marks = {
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      strike: editor?.isActive('strike') ?? false,
      code: editor?.isActive('code') ?? false,
      link: editor?.isActive('link') ?? false,
    };
    floatingToolbar.value = {
      visible: true,
      top: Math.max(4, rawTop),
      left: Math.max(toolbarWidth / 2 + 4, Math.min(rawLeft, window.innerWidth - toolbarWidth / 2 - 4)),
      blockId: block.id,
      activeMarks: marks,
    };
  } else {
    floatingToolbar.value = { visible: false, top: 0, left: 0, blockId: '', activeMarks: { bold: false, italic: false, strike: false, code: false, link: false } };
  }
}

// --- Floating toolbar commands ---
const blockRefs = ref<Map<string, { getEditor?: () => unknown }>>(new Map());

function setBlockRef(blockId: string, el: unknown): void {
  if (el && typeof el === 'object' && 'getEditor' in el) {
    blockRefs.value.set(blockId, el as { getEditor: () => unknown });
  }
}

function getActiveEditorForBlock(blockId: string): TipTapEditor | null {
  const ref = blockRefs.value.get(blockId);
  return (ref?.getEditor?.() as TipTapEditor) ?? null;
}

function getActiveEditor(): unknown {
  const ref = blockRefs.value.get(floatingToolbar.value.blockId);
  return ref?.getEditor?.() ?? null;
}

interface TipTapChainable {
  focus: () => TipTapChainable;
  toggleMark: (mark: string) => TipTapChainable;
  unsetLink: () => TipTapChainable;
  extendMarkRange: (type: string) => TipTapChainable;
  setLink: (attrs: { href: string }) => TipTapChainable;
  run: () => void;
}

interface TipTapEditor {
  chain: () => TipTapChainable;
  isActive: (name: string) => boolean;
}

function toggleMark(mark: string): void {
  const editor = getActiveEditor() as TipTapEditor | null;
  if (!editor) return;
  editor.chain().focus().toggleMark(mark).run();
}

// --- Link URL inline prompt ---
const linkPrompt = ref<{ visible: boolean; url: string }>({ visible: false, url: '' });

function toggleLink(): void {
  const editor = getActiveEditor() as TipTapEditor | null;
  if (!editor) return;
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  // Open inline prompt instead of window.prompt
  linkPrompt.value = { visible: true, url: '' };
}

function applyLink(): void {
  const url = linkPrompt.value.url.trim();
  linkPrompt.value = { visible: false, url: '' };
  if (!url) return;
  const editor = getActiveEditor() as TipTapEditor | null;
  if (!editor) return;
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

function cancelLink(): void {
  linkPrompt.value = { visible: false, url: '' };
  const editor = getActiveEditor() as TipTapEditor | null;
  editor?.chain().focus().run();
}

// --- Empty state ---
function addFirstBlock(): void {
  props.blockEditor.addBlock('paragraph');
}

// --- Block actions ---
function onSelect(block: EditorBlock): void {
  props.blockEditor.selectBlock(block.id);
}

function onDelete(block: EditorBlock): void {
  props.blockEditor.removeBlock(block.id);
}

function onDuplicate(block: EditorBlock): void {
  props.blockEditor.duplicateBlock(block.id);
}

function onMoveUp(block: EditorBlock): void {
  props.blockEditor.moveBlockUp(block.id);
}

function onMoveDown(block: EditorBlock): void {
  props.blockEditor.moveBlockDown(block.id);
}

function onBlockUpdate(block: EditorBlock, content: Record<string, unknown>): void {
  props.blockEditor.updateBlock(block.id, content);
}

function onEnterAtEnd(block: EditorBlock): void {
  const idx = props.blockEditor.getBlockIndex(block.id);
  if (idx === -1) return;
  props.blockEditor.addBlock('paragraph', undefined, idx + 1);
}

function onBackspaceEmpty(block: EditorBlock): void {
  const idx = props.blockEditor.getBlockIndex(block.id);
  if (idx === -1) return;
  if (props.blockEditor.blocks.value.length <= 1) return;
  props.blockEditor.removeBlock(block.id);
}

// --- Drag and drop ---
const draggedBlockId = ref<string | null>(null);

function onDragStart(block: EditorBlock): void {
  draggedBlockId.value = block.id;
}

function onDragEnd(): void {
  draggedBlockId.value = null;
}

function onDrop(atIndex: number, event: DragEvent): void {
  event.preventDefault();
  if (!draggedBlockId.value) return;

  const fromIndex = props.blockEditor.getBlockIndex(draggedBlockId.value);
  if (fromIndex === -1) return;

  const toIndex = atIndex > fromIndex ? atIndex - 1 : atIndex;
  props.blockEditor.moveBlock(fromIndex, toIndex);
  draggedBlockId.value = null;
}

// --- Click outside to deselect ---
function onCanvasClick(): void {
  props.blockEditor.selectBlock(null);
  floatingToolbar.value = { visible: false, top: 0, left: 0, blockId: '', activeMarks: { bold: false, italic: false, strike: false, code: false, link: false } };
}

// --- Resolve block component (injected overrides take priority) ---
function getBlockComponent(type: string): Component {
  return componentOverrides[type] ?? BLOCK_COMPONENTS[type] ?? TextBlock;
}

/** Compute auto-numbered content for buildStep blocks */
function getBlockContent(block: EditorBlock, index: number): Record<string, unknown> {
  if (block.type === 'buildStep') {
    let stepNum = 1;
    for (let i = 0; i < index; i++) {
      if (props.blockEditor.blocks.value[i].type === 'buildStep') stepNum++;
    }
    return { ...block.content, stepNumber: stepNum };
  }
  return block.content;
}

/** Check if a block type uses the TextBlock component (supports slash commands) */
function isTextBlock(type: string): boolean {
  return type === 'paragraph' || type === 'bulletList' || type === 'orderedList';
}

/** Check if a block type needs the onUpload prop */
function needsUpload(type: string): boolean {
  return type === 'image' || type === 'gallery';
}

/** Check if a block type needs the onSearchProducts prop */
function needsSearch(type: string): boolean {
  return type === 'partsList';
}

// --- Keyboard shortcuts ---
function onKeydown(event: KeyboardEvent): void {
  const mod = event.metaKey || event.ctrlKey;
  const el = document.activeElement;
  const inProseMirror = !!el?.closest('.ProseMirror');
  const inFormField = el?.tagName === 'TEXTAREA' || el?.tagName === 'INPUT' || el?.tagName === 'SELECT';

  // Undo/Redo: Ctrl+Z / Ctrl+Shift+Z
  if (mod && event.key.toLowerCase() === 'z') {
    if (inProseMirror || inFormField) return;
    event.preventDefault();
    if (event.shiftKey) { props.blockEditor.redo(); } else { props.blockEditor.undo(); }
    return;
  }

  // Block operations only when a block is selected and not editing text
  const selectedId = props.blockEditor.selectedBlockId.value;
  if (!selectedId || inProseMirror || inFormField) return;

  // Ctrl+Shift+ArrowUp: move block up
  if (mod && event.shiftKey && event.key === 'ArrowUp') {
    event.preventDefault();
    props.blockEditor.moveBlockUp(selectedId);
    return;
  }

  // Ctrl+Shift+ArrowDown: move block down
  if (mod && event.shiftKey && event.key === 'ArrowDown') {
    event.preventDefault();
    props.blockEditor.moveBlockDown(selectedId);
    return;
  }

  // Ctrl+D: duplicate block
  if (mod && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    props.blockEditor.duplicateBlock(selectedId);
    return;
  }

  // Delete / Backspace: remove selected block
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    props.blockEditor.removeBlock(selectedId);
    return;
  }
}

onMounted(() => { document.addEventListener('keydown', onKeydown); });
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); });
</script>

<template>
  <div class="cpub-block-canvas" @click.self="onCanvasClick">
    <!-- Page card wrapper -->
    <div class="cpub-canvas-page">

    <!-- Empty state -->
    <div v-if="blockEditor.isEmpty.value" class="cpub-canvas-empty" @click="addFirstBlock">
      <div class="cpub-canvas-empty-icon"><i class="fa-solid fa-pen-nib"></i></div>
      <p class="cpub-canvas-empty-title">Start writing</p>
      <p class="cpub-canvas-empty-desc">Click here to begin, or use the sidebar to add blocks</p>
    </div>

    <!-- Insert zone at top -->
    <BlockInsertZone @insert="openPicker(0)" />
    <!-- Picker at top position -->
    <div v-if="pickerVisible && !slashCommandBlockId && pickerInsertIndex === 0" class="cpub-canvas-picker-anchor">
      <BlockPicker :groups="blockTypes" :visible="true" @select="onPickerSelect" @close="closePicker" />
    </div>

    <!-- Block list -->
    <template v-for="(block, index) in blockEditor.blocks.value" :key="block.id">
      <BlockWrapper
        :block="block"
        :selected="blockEditor.selectedBlockId.value === block.id"
        @select="onSelect(block)"
        @delete="onDelete(block)"
        @duplicate="onDuplicate(block)"
        @move-up="onMoveUp(block)"
        @move-down="onMoveDown(block)"
        @drag-start="onDragStart(block)"
        @drag-end="onDragEnd"
      >
        <component
          :is="getBlockComponent(block.type)"
          :ref="(el: unknown) => isTextBlock(block.type) && setBlockRef(block.id, el)"
          :content="getBlockContent(block, index)"
          v-bind="{
            ...(needsUpload(block.type) && resolvedUpload ? { onUpload: resolvedUpload } : {}),
            ...(needsSearch(block.type) && resolvedSearch ? { onSearchProducts: resolvedSearch } : {}),
          }"
          @update="(c: Record<string, unknown>) => onBlockUpdate(block, c)"
          @slash-command="openSlashPicker(block)"
          @selection-change="(has: boolean, rect: DOMRect | null) => onSelectionChange(block, has, rect)"
          @enter-at-end="onEnterAtEnd(block)"
          @backspace-empty="onBackspaceEmpty(block)"
        />
      </BlockWrapper>

      <!-- Picker: slash command replaces this block -->
      <div v-if="pickerVisible && slashCommandBlockId === block.id" class="cpub-canvas-picker-anchor">
        <BlockPicker :groups="blockTypes" :visible="true" @select="onPickerSelect" @close="closePicker" />
      </div>

      <!-- Insert zone after each block -->
      <BlockInsertZone
        @insert="openPicker(index + 1)"
        @drop="onDrop(index + 1, $event)"
      />

      <!-- Picker: insert zone triggered at this position -->
      <div v-if="pickerVisible && !slashCommandBlockId && pickerInsertIndex === index + 1" class="cpub-canvas-picker-anchor">
        <BlockPicker :groups="blockTypes" :visible="true" @select="onPickerSelect" @close="closePicker" />
      </div>
    </template>

    </div><!-- /.cpub-canvas-page -->

    <!-- Floating text toolbar -->
    <Teleport to="body">
      <div
        v-if="floatingToolbar.visible"
        class="cpub-floating-toolbar"
        :style="{ top: floatingToolbar.top + 'px', left: floatingToolbar.left + 'px' }"
      >
        <button class="cpub-ft-btn" :class="{ 'cpub-ft-btn--active': floatingToolbar.activeMarks.bold }" title="Bold" @mousedown.prevent="toggleMark('bold')">
          <i class="fa-solid fa-bold"></i>
        </button>
        <button class="cpub-ft-btn" :class="{ 'cpub-ft-btn--active': floatingToolbar.activeMarks.italic }" title="Italic" @mousedown.prevent="toggleMark('italic')">
          <i class="fa-solid fa-italic"></i>
        </button>
        <button class="cpub-ft-btn" :class="{ 'cpub-ft-btn--active': floatingToolbar.activeMarks.strike }" title="Strikethrough" @mousedown.prevent="toggleMark('strike')">
          <i class="fa-solid fa-strikethrough"></i>
        </button>
        <button class="cpub-ft-btn" :class="{ 'cpub-ft-btn--active': floatingToolbar.activeMarks.code }" title="Inline code" @mousedown.prevent="toggleMark('code')">
          <i class="fa-solid fa-code"></i>
        </button>
        <div class="cpub-ft-divider" />
        <button class="cpub-ft-btn" :class="{ 'cpub-ft-btn--active': floatingToolbar.activeMarks.link }" title="Link" @mousedown.prevent="toggleLink">
          <i class="fa-solid fa-link"></i>
        </button>
      </div>
      <!-- Inline link URL prompt -->
      <div
        v-if="linkPrompt.visible && floatingToolbar.visible"
        class="cpub-link-prompt"
        :style="{ top: (floatingToolbar.top + 38) + 'px', left: floatingToolbar.left + 'px' }"
      >
        <input
          v-model="linkPrompt.url"
          class="cpub-link-prompt-input"
          type="url"
          placeholder="https://..."
          autofocus
          @keydown.enter.prevent="applyLink"
          @keydown.escape.prevent="cancelLink"
        />
        <button class="cpub-link-prompt-btn" @mousedown.prevent="applyLink">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="cpub-link-prompt-btn cpub-link-prompt-btn--cancel" @mousedown.prevent="cancelLink">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cpub-block-canvas {
  padding: 36px 0 52px;
  min-height: 300px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cpub-canvas-page {
  width: 100%;
  max-width: 680px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  padding: 44px 56px;
  position: relative;
}

@media (max-width: 768px) {
  .cpub-canvas-page {
    border: none;
    box-shadow: none;
    padding: 16px;
  }
  .cpub-block-canvas {
    padding: 8px 0 48px;
  }
}

.cpub-canvas-empty {
  text-align: center;
  padding: 48px 24px 32px;
  cursor: pointer;
  border: 2px dashed transparent;
  transition: border-color 0.15s, background 0.15s;
}

.cpub-canvas-empty:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.cpub-canvas-empty-icon {
  font-size: 32px;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.cpub-canvas-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 6px;
}

.cpub-canvas-empty-desc {
  font-size: 12px;
  color: var(--text-faint);
}

.cpub-canvas-picker-anchor {
  position: relative;
  display: flex;
  justify-content: center;
}
</style>

<!-- Floating toolbar styles (global since it's teleported) -->
<style>
.cpub-floating-toolbar {
  --ft-surface: rgba(255, 255, 255, 0.15);
  position: fixed;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--text, #1a1a1a);
  border: var(--border-width-default) solid var(--border, #1a1a1a);
  box-shadow: var(--shadow-md);
  padding: 3px;
  transform: translateX(-50%);
  pointer-events: auto;
}

.cpub-ft-btn {
  width: 30px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--surface3, #eaeae7);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
  transition: background 0.08s, color 0.08s;
}

.cpub-ft-btn:hover {
  background: var(--ft-surface);
  color: var(--surface, #fff);
}

.cpub-ft-btn--active {
  background: var(--ft-surface);
  color: var(--accent, #5b9cf6);
}

.cpub-ft-divider {
  width: 2px;
  height: 18px;
  background: var(--ft-surface);
  margin: 0 2px;
}

.cpub-link-prompt {
  position: fixed;
  z-index: 201;
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--text, #1a1a1a);
  border: var(--border-width-default, 2px) solid var(--border, #1a1a1a);
  box-shadow: var(--shadow-md);
  padding: 3px;
  transform: translateX(-50%);
}

.cpub-link-prompt-input {
  width: 200px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  color: var(--surface3, #eaeae7);
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  outline: none;
}

.cpub-link-prompt-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.cpub-link-prompt-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--surface3, #eaeae7);
  cursor: pointer;
  font-size: 10px;
}

.cpub-link-prompt-btn:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }
.cpub-link-prompt-btn--cancel:hover { background: var(--red, #e04030); color: #fff; }
</style>
