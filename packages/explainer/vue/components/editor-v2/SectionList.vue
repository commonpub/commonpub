<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ExplainerDocSection } from '@commonpub/explainer';
import { getModule } from '../../../modules/registry';

const props = defineProps<{
  sections: ExplainerDocSection[];
  selectedId: string | null;
  /** Whether the intro (hero) or conclusion virtual item is selected */
  pinnedSelection?: 'intro' | 'conclusion' | null;
}>();

const emit = defineEmits<{
  select: [sectionId: string];
  'select-pinned': [which: 'intro' | 'conclusion'];
  add: [];
  move: [fromIndex: number, toIndex: number];
  delete: [sectionId: string];
  duplicate: [sectionId: string];
}>();

function getModuleColor(section: ExplainerDocSection): string {
  const mod = section.module ? getModule(section.module.type) : getModule('text-only');
  return mod?.meta.color ?? '#6b7280';
}

function getModuleName(section: ExplainerDocSection): string {
  const mod = section.module ? getModule(section.module.type) : getModule('text-only');
  return mod?.meta.name ?? 'Text';
}

// Drag state
const dragIdx = ref<number | null>(null);
const dropIdx = ref<number | null>(null);

function onDragStart(idx: number, e: DragEvent): void {
  dragIdx.value = idx;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }
}

function onDragOver(idx: number, e: DragEvent): void {
  if (dragIdx.value === idx) return;
  e.preventDefault();
  dropIdx.value = idx;
}

function onDrop(idx: number): void {
  if (dragIdx.value !== null && dragIdx.value !== idx) {
    emit('move', dragIdx.value, idx);
  }
  dragIdx.value = null;
  dropIdx.value = null;
}

function onDragEnd(): void {
  dragIdx.value = null;
  dropIdx.value = null;
}
</script>

<template>
  <div class="cpub-section-list">
    <!-- Pinned: Introduction (hero) -->
    <div
      class="cpub-section-item cpub-section-item-pinned"
      :class="{ 'cpub-section-item-selected': pinnedSelection === 'intro' }"
      @click="emit('select-pinned', 'intro')"
    >
      <div class="cpub-section-pin"><i class="fa-solid fa-thumbtack" /></div>
      <div class="cpub-section-info">
        <span class="cpub-section-title">Introduction</span>
        <span class="cpub-section-badge" style="color: var(--text-faint)">
          <span class="cpub-section-badge-dot" style="background: var(--accent)" />
          Hero
        </span>
      </div>
    </div>

    <!-- Content sections (draggable) -->
    <div
      v-for="(section, idx) in sections"
      :key="section.id"
      class="cpub-section-item"
      :class="{
        'cpub-section-item-selected': selectedId === section.id && !pinnedSelection,
        'cpub-section-item-dragging': dragIdx === idx,
        'cpub-section-item-drop': dropIdx === idx,
      }"
      draggable="true"
      @click="emit('select', section.id)"
      @dragstart="onDragStart(idx, $event)"
      @dragover="onDragOver(idx, $event)"
      @dragleave="dropIdx = null"
      @drop.prevent="onDrop(idx)"
      @dragend="onDragEnd"
    >
      <div
        class="cpub-section-num"
        :class="{ 'cpub-section-num-active': selectedId === section.id && !pinnedSelection }"
      >
        {{ idx + 1 }}
      </div>
      <div class="cpub-section-info">
        <span class="cpub-section-title">{{ section.heading || 'Untitled' }}</span>
        <span class="cpub-section-badge" :style="{ color: getModuleColor(section) }">
          <span class="cpub-section-badge-dot" :style="{ background: getModuleColor(section) }" />
          {{ getModuleName(section) }}
        </span>
      </div>
    </div>

    <button class="cpub-section-add-btn" @click="emit('add')">
      <i class="fa-solid fa-plus" /> Add Section
    </button>

    <!-- Pinned: Conclusion -->
    <div
      class="cpub-section-item cpub-section-item-pinned"
      :class="{ 'cpub-section-item-selected': pinnedSelection === 'conclusion' }"
      @click="emit('select-pinned', 'conclusion')"
    >
      <div class="cpub-section-pin"><i class="fa-solid fa-thumbtack" /></div>
      <div class="cpub-section-info">
        <span class="cpub-section-title">Conclusion</span>
        <span class="cpub-section-badge" style="color: var(--text-faint)">
          <span class="cpub-section-badge-dot" style="background: var(--green)" />
          Wrap-up
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-section-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.cpub-section-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px 8px 12px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: all 0.1s;
}

.cpub-section-item:hover {
  background: var(--surface2);
}

.cpub-section-item-selected {
  background: var(--accent-bg);
  border-left-color: var(--accent);
}

.cpub-section-item-dragging {
  opacity: 0.4;
}

.cpub-section-item-drop {
  border-top: 2px solid var(--accent);
}

.cpub-section-num {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  background: var(--surface3);
  color: var(--text-faint);
  flex-shrink: 0;
  margin-top: 1px;
}

.cpub-section-num-active {
  background: var(--accent);
  color: var(--color-text-inverse);
}

.cpub-section-info {
  flex: 1;
  min-width: 0;
}

.cpub-section-title {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cpub-section-item-selected .cpub-section-title {
  color: var(--text);
}

.cpub-section-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 9px;
  margin-top: 2px;
}

.cpub-section-badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cpub-section-item-pinned {
  opacity: 0.7;
  cursor: pointer;
}

.cpub-section-item-pinned:hover {
  opacity: 1;
}

.cpub-section-item-pinned.cpub-section-item-selected {
  opacity: 1;
}

.cpub-section-pin {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: var(--text-faint);
  flex-shrink: 0;
  margin-top: 1px;
}

.cpub-section-item-pinned.cpub-section-item-selected .cpub-section-pin {
  color: var(--accent);
}

.cpub-section-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  margin-top: 4px;
  background: none;
  border: 2px dashed var(--border2);
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.cpub-section-add-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
