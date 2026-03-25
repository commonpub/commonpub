<script setup lang="ts">
/**
 * Insert zone between blocks — shows "+ Insert block" button.
 * Appears between every block and at the top/bottom of the canvas.
 */
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
    :class="{ 'cpub-insert-zone--dragover': isDragOver }"
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
  height: 8px;
  position: relative;
  transition: height 0.15s;
}

.cpub-insert-zone:hover,
.cpub-insert-zone--dragover {
  height: 36px;
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
  border: 2px dashed transparent;
  padding: 4px 14px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.1s, border-color 0.1s, color 0.1s;
}

.cpub-insert-zone:hover .cpub-insert-btn,
.cpub-insert-zone--dragover .cpub-insert-btn {
  opacity: 1;
  border-color: var(--border2);
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
