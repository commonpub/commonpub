<script setup lang="ts">
/**
 * Build step block — numbered step with title, time, and nested child blocks.
 * Uses its own useBlockEditor instance for children (text, image, code, callout, divider).
 * Migrates old flat format (instructions + image) to children on load.
 */
import { ref, computed, watch, inject, type Component } from 'vue';
import type { BlockTuple } from '@commonpub/editor';
import { useBlockEditor } from '../../composables/useBlockEditor.js';
import { UPLOAD_HANDLER_KEY } from '../../provide.js';

import TextBlock from './TextBlock.vue';
import ImageBlock from './ImageBlock.vue';
import CodeBlock from './CodeBlock.vue';
import CalloutBlock from './CalloutBlock.vue';
import DividerBlock from './DividerBlock.vue';

const CHILD_COMPONENTS: Record<string, Component> = {
  paragraph: TextBlock,
  text: TextBlock,
  image: ImageBlock,
  code: CodeBlock,
  code_block: CodeBlock,
  codeBlock: CodeBlock,
  callout: CalloutBlock,
  divider: DividerBlock,
  horizontalRule: DividerBlock,
};

const INSERTABLE_TYPES = [
  { type: 'paragraph', label: 'Text', icon: 'fa-solid fa-paragraph' },
  { type: 'image', label: 'Image', icon: 'fa-regular fa-image' },
  { type: 'code_block', label: 'Code', icon: 'fa-solid fa-code' },
  { type: 'callout', label: 'Callout', icon: 'fa-solid fa-circle-info' },
  { type: 'divider', label: 'Divider', icon: 'fa-solid fa-minus' },
] as const;

const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const uploadHandler = inject(UPLOAD_HANDLER_KEY, undefined);

const stepNumber = computed(() => (props.content.stepNumber as number) ?? 1);
const title = computed(() => (props.content.title as string) ?? '');
const time = computed(() => (props.content.time as string) ?? '');

// --- Migration: old flat format → children BlockTuple[] ---
function migrateToChildren(content: Record<string, unknown>): BlockTuple[] {
  if (content.children && Array.isArray(content.children) && content.children.length > 0) {
    return content.children as BlockTuple[];
  }
  const children: BlockTuple[] = [];
  const instructions = content.instructions as string | undefined;
  if (instructions && instructions.trim()) {
    // Wrap plain text in <p> tags if not already HTML
    const html = instructions.startsWith('<') ? instructions : `<p>${instructions}</p>`;
    children.push(['paragraph', { html }]);
  }
  const image = content.image as string | undefined;
  if (image && image.trim()) {
    children.push(['image', { src: image, alt: '', caption: '' }]);
  }
  if (children.length === 0) {
    children.push(['paragraph', { html: '' }]);
  }
  return children;
}

// --- Child block editor ---
const initialChildren = migrateToChildren(props.content);
const childEditor = useBlockEditor(initialChildren);

/** Track what we last emitted so we can distinguish our own updates from external (undo) */
let lastEmittedJson = JSON.stringify(initialChildren);

function emitFullUpdate(): void {
  const children = childEditor.toBlockTuples();
  lastEmittedJson = JSON.stringify(children);
  emit('update', {
    stepNumber: stepNumber.value,
    title: title.value,
    time: time.value,
    children,
  });
}

function updateField(field: string, value: unknown): void {
  const children = childEditor.toBlockTuples();
  lastEmittedJson = JSON.stringify(children);
  emit('update', {
    stepNumber: stepNumber.value,
    title: title.value,
    time: time.value,
    children,
    [field]: value,
  });
}

function onChildUpdate(blockId: string, content: Record<string, unknown>): void {
  childEditor.updateBlock(blockId, content);
  emitFullUpdate();
}

function addChild(type: string): void {
  childEditor.addBlock(type);
  emitFullUpdate();
}

function removeChild(blockId: string): void {
  if (childEditor.blocks.value.length <= 1) return;
  childEditor.removeBlock(blockId);
  emitFullUpdate();
}

function moveChildUp(blockId: string): void {
  childEditor.moveBlockUp(blockId);
  emitFullUpdate();
}

function moveChildDown(blockId: string): void {
  childEditor.moveBlockDown(blockId);
  emitFullUpdate();
}

function getChildComponent(type: string): Component {
  return CHILD_COMPONENTS[type] ?? TextBlock;
}

function needsUpload(type: string): boolean {
  return type === 'image';
}

// --- Sync from external changes (undo/redo) ---
watch(
  () => props.content.children,
  (newChildren) => {
    if (!newChildren || !Array.isArray(newChildren)) return;
    const newJson = JSON.stringify(newChildren);
    if (newJson === lastEmittedJson) return;
    // External change — re-initialize child editor
    lastEmittedJson = newJson;
    childEditor.fromBlockTuples(newChildren as BlockTuple[]);
  },
  { deep: true },
);

// --- Add menu ---
const showAddMenu = ref(false);

function toggleAddMenu(): void {
  showAddMenu.value = !showAddMenu.value;
}

function onAddType(type: string): void {
  showAddMenu.value = false;
  addChild(type);
}
</script>

<template>
  <div class="cpub-step-block">
    <div class="cpub-step-header">
      <div class="cpub-step-num">{{ stepNumber }}</div>
      <input
        class="cpub-step-title"
        type="text"
        :value="title"
        placeholder="Step title..."
        @input="updateField('title', ($event.target as HTMLInputElement).value)"
      />
      <input
        class="cpub-step-time"
        type="text"
        :value="time"
        placeholder="Time"
        @input="updateField('time', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="cpub-step-children">
      <div
        v-for="(block, idx) in childEditor.blocks.value"
        :key="block.id"
        class="cpub-step-child"
      >
        <component
          :is="getChildComponent(block.type)"
          :content="block.content"
          v-bind="needsUpload(block.type) && uploadHandler ? { onUpload: uploadHandler } : {}"
          @update="(c: Record<string, unknown>) => onChildUpdate(block.id, c)"
        />
        <div class="cpub-step-child-actions">
          <button
            v-if="idx > 0"
            class="cpub-step-child-btn"
            title="Move up"
            @click="moveChildUp(block.id)"
          >
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <button
            v-if="idx < childEditor.blocks.value.length - 1"
            class="cpub-step-child-btn"
            title="Move down"
            @click="moveChildDown(block.id)"
          >
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <button
            v-if="childEditor.blocks.value.length > 1"
            class="cpub-step-child-btn cpub-step-child-btn--danger"
            title="Remove block"
            @click="removeChild(block.id)"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Add block button -->
      <div class="cpub-step-add-row">
        <button class="cpub-step-add-btn" @click="toggleAddMenu">
          <i class="fa-solid fa-plus"></i> Add block
        </button>
        <div v-if="showAddMenu" class="cpub-step-add-menu">
          <button
            v-for="t in INSERTABLE_TYPES"
            :key="t.type"
            class="cpub-step-add-option"
            @click="onAddType(t.type)"
          >
            <i :class="t.icon"></i> {{ t.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-step-block {
  border: var(--border-width-default) solid var(--accent-border);
  border-left: 4px solid var(--accent);
  background: var(--surface);
}

.cpub-step-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px;
  border-bottom: var(--border-width-default) solid var(--border2);
  background: var(--accent-bg);
}

.cpub-step-num {
  width: 32px; height: 32px;
  background: var(--accent); color: var(--color-text-inverse);
  font-family: var(--font-mono); font-size: 14px; font-weight: 700;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.cpub-step-title {
  flex: 1; font-size: 14px; font-weight: 600;
  background: transparent; border: none; outline: none;
  color: var(--text);
}
.cpub-step-title::placeholder { color: var(--text-faint); }

.cpub-step-time {
  width: 80px; font-family: var(--font-mono); font-size: 10px;
  background: transparent; border: var(--border-width-default) solid var(--border2);
  padding: 3px 6px; color: var(--text-dim); outline: none;
  text-align: center;
}
.cpub-step-time:focus { border-color: var(--accent); }
.cpub-step-time::placeholder { color: var(--text-faint); }

/* --- Children --- */
.cpub-step-children {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cpub-step-child {
  position: relative;
  border: var(--border-width-default) solid transparent;
  padding: 4px 0;
  transition: border-color 0.1s;
}

.cpub-step-child:hover {
  border-color: var(--border2);
}

.cpub-step-child-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.1s;
}

.cpub-step-child:hover .cpub-step-child-actions {
  opacity: 1;
}

.cpub-step-child-btn {
  width: 22px; height: 22px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border2);
  color: var(--text-faint);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  padding: 0;
}

.cpub-step-child-btn:hover {
  background: var(--surface3);
  color: var(--text);
}

.cpub-step-child-btn--danger:hover {
  background: var(--red-bg);
  color: var(--red);
  border-color: var(--red-border);
}

/* --- Add block --- */
.cpub-step-add-row {
  position: relative;
  display: flex;
  align-items: center;
  padding-top: 4px;
}

.cpub-step-add-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  font-size: 11px; font-family: var(--font-mono);
  background: transparent;
  border: var(--border-width-default) dashed var(--border2);
  color: var(--text-faint);
  cursor: pointer;
  transition: all 0.1s;
}

.cpub-step-add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.cpub-step-add-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  display: flex;
  gap: 0;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-md);
  z-index: 10;
}

.cpub-step-add-option {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
}

.cpub-step-add-option:hover {
  background: var(--accent-bg);
  color: var(--accent);
}
</style>
