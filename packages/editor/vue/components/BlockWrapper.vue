<script setup lang="ts">
/**
 * Block wrapper — wraps every content block with:
 * - Drag handle (left, appears on hover)
 * - Block controls (top-right: move, clone, delete)
 * - Selected state (accent outline)
 * - Click-to-select
 */
import { ref, watch } from 'vue';
import type { EditorBlock } from '../types.js';

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

// Two-step delete: first click arms, second click confirms
const deleteArmed = ref(false);
let deleteTimer: ReturnType<typeof setTimeout> | null = null;

function handleDelete(): void {
  if (deleteArmed.value) {
    emit('delete');
    deleteArmed.value = false;
    if (deleteTimer) { clearTimeout(deleteTimer); deleteTimer = null; }
  } else {
    deleteArmed.value = true;
    deleteTimer = setTimeout(() => { deleteArmed.value = false; }, 2000);
  }
}

// Reset armed state when block loses selection
watch(() => props.selected, (sel) => {
  if (!sel) {
    deleteArmed.value = false;
    if (deleteTimer) { clearTimeout(deleteTimer); deleteTimer = null; }
  }
});

function onDragStart(event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', props.block.id);
  event.dataTransfer!.effectAllowed = 'move';

  // Custom drag preview showing block type
  const preview = document.createElement('div');
  preview.textContent = props.block.type.replace(/_/g, ' ');
  preview.style.cssText = 'position:fixed;top:-999px;left:-999px;padding:6px 12px;background:#1a1a1a;color:#eee;font-family:monospace;font-size:11px;font-weight:600;text-transform:capitalize;border:2px solid #333;pointer-events:none;white-space:nowrap;';
  document.body.appendChild(preview);
  event.dataTransfer!.setDragImage(preview, 0, 0);
  requestAnimationFrame(() => document.body.removeChild(preview));

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
        aria-label="Drag to reorder"
        draggable="true"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
      >
        <i class="fa-solid fa-grip-vertical"></i>
      </button>
    </div>

    <!-- Block type badge (top-left, shown on hover) -->
    <div class="cpub-block-type-badge">{{ block.type.replace(/_/g, ' ') }}</div>

    <!-- Block controls (top-right, shown on hover) -->
    <div class="cpub-block-controls">
      <button class="cpub-block-ctrl" aria-label="Move up" @click.stop="emit('move-up')">
        <i class="fa-solid fa-arrow-up"></i>
      </button>
      <button class="cpub-block-ctrl" aria-label="Move down" @click.stop="emit('move-down')">
        <i class="fa-solid fa-arrow-down"></i>
      </button>
      <button class="cpub-block-ctrl" aria-label="Duplicate" @click.stop="emit('duplicate')">
        <i class="fa-solid fa-copy"></i>
      </button>
      <button
        class="cpub-block-ctrl"
        :class="deleteArmed ? 'cpub-block-ctrl--armed' : 'cpub-block-ctrl--danger'"
        :aria-label="deleteArmed ? 'Click again to confirm delete' : 'Delete block'"
        @click.stop="handleDelete"
      >
        <template v-if="deleteArmed">
          <i class="fa-solid fa-check"></i>
        </template>
        <template v-else>
          <i class="fa-solid fa-trash"></i>
        </template>
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
  border: var(--border-width-default) solid transparent;
  transition: border-color 0.12s;
}

.cpub-block-wrap:hover {
  border-color: var(--border2);
}

.cpub-block-wrap--selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-bg);
}

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
.cpub-block-wrap--selected .cpub-block-handle,
.cpub-block-wrap:focus-within .cpub-block-handle {
  opacity: 1;
}

.cpub-handle-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border2);
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

.cpub-block-type-badge {
  position: absolute;
  top: -22px;
  left: 0;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: capitalize;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  opacity: 0;
  transition: opacity 0.12s;
  pointer-events: none;
}

.cpub-block-wrap:hover .cpub-block-type-badge {
  opacity: 1;
}

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
.cpub-block-wrap--selected .cpub-block-controls,
.cpub-block-wrap:focus-within .cpub-block-controls {
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

.cpub-block-ctrl--armed {
  background: var(--red);
  color: var(--surface);
  animation: cpub-pulse 0.6s ease-in-out infinite alternate;
}

@keyframes cpub-pulse {
  from { opacity: 1; }
  to { opacity: 0.6; }
}

.cpub-block-inner {
  min-height: 20px;
}

@media (hover: none) {
  .cpub-block-wrap--selected .cpub-block-handle { opacity: 1; }
  .cpub-block-wrap--selected .cpub-block-controls { opacity: 1; }
}
</style>
