<script setup lang="ts">
/**
 * Insert zone between blocks — shows "+ Insert block" button.
 * Appears between every block and at the top/bottom of the canvas.
 * Button shows on hover unless `alwaysVisible` is set.
 */
import { ref } from 'vue';

defineProps<{
  alwaysVisible?: boolean;
}>();

defineEmits<{
  insert: [];
}>();

const isDragOver = ref(false);

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'move';
  isDragOver.value = true;
}

function onDragLeave(): void {
  isDragOver.value = false;
}
</script>

<template>
  <div
    class="cpub-insert-zone"
    :class="{
      'cpub-insert-zone--dragover': isDragOver,
      'cpub-insert-zone--hover-only': !alwaysVisible,
    }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="isDragOver = false"
  >
    <button class="cpub-insert-btn" @click="$emit('insert')">
      <i class="fa-solid fa-plus"></i>
      <span>Insert block</span>
    </button>
  </div>
</template>

<style scoped>
.cpub-insert-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  position: relative;
}

.cpub-insert-zone--hover-only .cpub-insert-btn {
  opacity: 0;
  transition: opacity 0.12s;
}

.cpub-insert-zone--hover-only:hover .cpub-insert-btn {
  opacity: 1;
}

.cpub-insert-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-faint);
  background: transparent;
  border: 2px dashed var(--border2, rgba(0, 0, 0, 0.08));
  padding: 4px 14px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}

.cpub-insert-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.cpub-insert-btn i {
  font-size: 9px;
}
</style>
