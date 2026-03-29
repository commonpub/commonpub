<script setup lang="ts">
/**
 * Block wrapper — wraps every content block with:
 * - Drag handle (left, appears on hover)
 * - Block controls (top-right: move, clone, delete)
 * - Selected state (accent outline)
 * - Click-to-select
 */
import type { EditorBlock } from '~/composables/useBlockEditor';

const props = defineProps<{
  block: EditorBlock;
  selected: boolean;
}>();

const emit = defineEmits<{
  select: [];
  delete: [];
  duplicate: [];
  'move-up': [];
  'move-down': [];
  'drag-start': [event: DragEvent];
  'drag-end': [event: DragEvent];
}>();

function onDragStart(event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', props.block.id);
  event.dataTransfer!.effectAllowed = 'move';
  emit('drag-start', event);
}

function onDragEnd(event: DragEvent): void {
  emit('drag-end', event);
}
</script>

<template>
  <div
    class="cpub-block-wrap"
    :class="{ 'cpub-block-wrap--selected': selected }"
    @click.stop="emit('select')"
  >
    <!-- Drag handle (left side) -->
    <div class="cpub-block-handle">
      <button
        class="cpub-handle-btn"
        title="Drag to reorder"
        draggable="true"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      >
        <i class="fa-solid fa-grip-vertical"></i>
      </button>
    </div>

    <!-- Block controls (top-right, shown on hover) -->
    <div class="cpub-block-controls">
      <button class="cpub-block-ctrl" title="Move up" @click.stop="emit('move-up')">
        <i class="fa-solid fa-arrow-up"></i>
      </button>
      <button class="cpub-block-ctrl" title="Move down" @click.stop="emit('move-down')">
        <i class="fa-solid fa-arrow-down"></i>
      </button>
      <button class="cpub-block-ctrl" title="Duplicate" @click.stop="emit('duplicate')">
        <i class="fa-solid fa-copy"></i>
      </button>
      <button class="cpub-block-ctrl cpub-block-ctrl--danger" title="Delete" @click.stop="emit('delete')">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>

    <!-- Block content -->
    <div class="cpub-block-inner">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cpub-block-wrap {
  position: relative;
  border: 2px solid transparent;
  transition: border-color 0.12s;
}

.cpub-block-wrap:hover {
  border-color: var(--border2);
}

.cpub-block-wrap--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

/* Drag handle — left side */
.cpub-block-handle {
  position: absolute;
  left: -36px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.12s;
}

.cpub-block-wrap:hover .cpub-block-handle,
.cpub-block-wrap--selected .cpub-block-handle {
  opacity: 1;
}

.cpub-handle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 2px solid var(--border2);
  color: var(--text-faint);
  cursor: grab;
  font-size: 11px;
  padding: 0;
}

.cpub-handle-btn:hover {
  border-color: var(--border);
  color: var(--text-dim);
  background: var(--surface2);
}

.cpub-handle-btn:active {
  cursor: grabbing;
}

/* Block controls — top-right, offset above the block */
.cpub-block-controls {
  --ctrl-surface: rgba(255, 255, 255, 0.15);
  position: absolute;
  top: -30px;
  right: 0;
  display: flex;
  gap: 0;
  background: var(--text);
  padding: 2px;
  opacity: 0;
  transition: opacity 0.12s;
  z-index: 10;
}

.cpub-block-wrap:hover .cpub-block-controls,
.cpub-block-wrap--selected .cpub-block-controls {
  opacity: 1;
}

.cpub-block-ctrl {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--surface3);
  cursor: pointer;
  font-size: 10px;
  padding: 0;
  transition: background 0.1s, color 0.1s;
}

.cpub-block-ctrl:hover {
  background: var(--ctrl-surface);
  color: var(--surface);
}

.cpub-block-ctrl--danger:hover {
  background: var(--red);
  color: var(--surface);
}

/* Block inner */
.cpub-block-inner {
  min-height: 20px;
}

/* Touch devices: always show controls since there's no hover */
@media (hover: none) {
  .cpub-block-handle { opacity: 1; }
  .cpub-block-controls { opacity: 1; }
}
</style>
