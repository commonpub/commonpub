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
import type { Component } from 'vue';
import type { BlockEditor, EditorBlock } from '~/composables/useBlockEditor';
import type { BlockTypeGroup } from './BlockPicker.vue';

// Direct imports — Nuxt auto-imports are compile-time only and don't work with <component :is>
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
}>();

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
    // Slash command: replace the text block with the chosen type
    props.blockEditor.replaceBlock(slashCommandBlockId.value, type, attrs);
  } else {
    // Normal insert
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
}>({ visible: false, top: 0, left: 0, blockId: '' });

function onSelectionChange(block: EditorBlock, hasSelection: boolean, rect: DOMRect | null): void {
  if (hasSelection && rect) {
    const toolbarWidth = 180; // approximate toolbar width
    const toolbarHeight = 44;
    const rawTop = rect.top - toolbarHeight;
    const rawLeft = rect.left + rect.width / 2;
    floatingToolbar.value = {
      visible: true,
      top: Math.max(4, rawTop),
      left: Math.max(toolbarWidth / 2 + 4, Math.min(rawLeft, window.innerWidth - toolbarWidth / 2 - 4)),
      blockId: block.id,
    };
  } else {
    floatingToolbar.value = { visible: false, top: 0, left: 0, blockId: '' };
  }
}

// --- Floating toolbar commands ---
const blockRefs = ref<Map<string, { getEditor?: () => unknown }>>(new Map());

function setBlockRef(blockId: string, el: unknown): void {
  if (el && typeof el === 'object' && 'getEditor' in el) {
    blockRefs.value.set(blockId, el as { getEditor: () => unknown });
  }
}

function getActiveEditor(): unknown {
  const ref = blockRefs.value.get(floatingToolbar.value.blockId);
  return ref?.getEditor?.() ?? null;
}

/** TipTap editor chain interface for toolbar commands */
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

function toggleLink(): void {
  const editor = getActiveEditor() as TipTapEditor | null;
  if (!editor) return;
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  const url = window.prompt('Enter URL:');
  if (url) {
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
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

/** Enter at end of a text block → create new paragraph below */
function onEnterAtEnd(block: EditorBlock): void {
  const idx = props.blockEditor.getBlockIndex(block.id);
  if (idx === -1) return;
  props.blockEditor.addBlock('paragraph', undefined, idx + 1);
}

/** Backspace in empty text block → delete it and focus previous */
function onBackspaceEmpty(block: EditorBlock): void {
  const idx = props.blockEditor.getBlockIndex(block.id);
  if (idx === -1) return;
  // Don't delete the last block
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
  floatingToolbar.value = { visible: false, top: 0, left: 0, blockId: '' };
}

// --- Resolve block component ---
function getBlockComponent(type: string): Component {
  return BLOCK_COMPONENTS[type] ?? TextBlock;
}

/** Compute auto-numbered content for buildStep blocks */
function getBlockContent(block: EditorBlock, index: number): Record<string, unknown> {
  if (block.type === 'buildStep') {
    // Count how many buildStep blocks precede this one
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
</script>

<template>
  <div class="cpub-block-canvas" @click.self="onCanvasClick">
    <!-- Page card wrapper — mimics document editing feel -->
    <div class="cpub-canvas-page">

    <!-- Empty state — click to create first paragraph -->
    <div v-if="blockEditor.isEmpty.value" class="cpub-canvas-empty" @click="addFirstBlock">
      <div class="cpub-canvas-empty-icon"><i class="fa-solid fa-pen-nib"></i></div>
      <p class="cpub-canvas-empty-title">Start writing</p>
      <p class="cpub-canvas-empty-desc">Click here to begin, or use the sidebar to add blocks</p>
    </div>

    <!-- Insert zone at top -->
    <EditorsBlockInsertZone @insert="openPicker(0)" />
    <!-- Picker at top position -->
    <div v-if="pickerVisible && !slashCommandBlockId && pickerInsertIndex === 0" class="cpub-canvas-picker-anchor">
      <EditorsBlockPicker :groups="blockTypes" :visible="true" @select="onPickerSelect" @close="closePicker" />
    </div>

    <!-- Block list -->
    <template v-for="(block, index) in blockEditor.blocks.value" :key="block.id">
      <EditorsBlockWrapper
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
          @update="(c: Record<string, unknown>) => onBlockUpdate(block, c)"
          @slash-command="openSlashPicker(block)"
          @selection-change="(has: boolean, rect: DOMRect | null) => onSelectionChange(block, has, rect)"
          @enter-at-end="onEnterAtEnd(block)"
          @backspace-empty="onBackspaceEmpty(block)"
        />
      </EditorsBlockWrapper>

      <!-- Picker: slash command replaces this block -->
      <div v-if="pickerVisible && slashCommandBlockId === block.id" class="cpub-canvas-picker-anchor">
        <EditorsBlockPicker :groups="blockTypes" :visible="true" @select="onPickerSelect" @close="closePicker" />
      </div>

      <!-- Insert zone after each block -->
      <EditorsBlockInsertZone
        @insert="openPicker(index + 1)"
        @drop="onDrop(index + 1, $event)"
      />

      <!-- Picker: insert zone triggered at this position -->
      <div v-if="pickerVisible && !slashCommandBlockId && pickerInsertIndex === index + 1" class="cpub-canvas-picker-anchor">
        <EditorsBlockPicker :groups="blockTypes" :visible="true" @select="onPickerSelect" @close="closePicker" />
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
        <button class="cpub-ft-btn" title="Bold" @mousedown.prevent="toggleMark('bold')">
          <i class="fa-solid fa-bold"></i>
        </button>
        <button class="cpub-ft-btn" title="Italic" @mousedown.prevent="toggleMark('italic')">
          <i class="fa-solid fa-italic"></i>
        </button>
        <button class="cpub-ft-btn" title="Strikethrough" @mousedown.prevent="toggleMark('strike')">
          <i class="fa-solid fa-strikethrough"></i>
        </button>
        <button class="cpub-ft-btn" title="Inline code" @mousedown.prevent="toggleMark('code')">
          <i class="fa-solid fa-code"></i>
        </button>
        <div class="cpub-ft-divider" />
        <button class="cpub-ft-btn" title="Link" @mousedown.prevent="toggleLink">
          <i class="fa-solid fa-link"></i>
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
  border: 2px solid var(--border);
  box-shadow: 4px 4px 0 var(--border);
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
  position: fixed;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 0;
  background: var(--text, #1a1a1a);
  border: 2px solid var(--border, #1a1a1a);
  box-shadow: 4px 4px 0 var(--border, #1a1a1a);
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
  background: rgba(255, 255, 255, 0.15);
  color: var(--surface, #fff);
}

.cpub-ft-divider {
  width: 2px;
  height: 18px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 2px;
}
</style>
