<script setup lang="ts">
/**
 * Block type picker — appears when clicking an insert zone.
 * Shows available block types grouped by category, with search.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import type { BlockTypeDef, BlockTypeGroup } from '../types.js';

const props = defineProps<{
  groups: BlockTypeGroup[];
  visible: boolean;
}>();

const emit = defineEmits<{
  select: [type: string, attrs?: Record<string, unknown>];
  close: [];
}>();

const search = ref('');
const selectedIndex = ref(0);
const pickerRef = ref<HTMLElement | null>(null);

const flatBlocks = computed(() => {
  return props.groups.flatMap((g) => g.blocks);
});

const isSearching = computed(() => search.value.trim().length > 0);

const filteredBlocks = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return flatBlocks.value;
  return flatBlocks.value.filter(
    (b) => b.label.toLowerCase().includes(q) || b.type.toLowerCase().includes(q),
  );
});

/** Flat index of a block across all groups (for keyboard nav) */
function globalIndex(groupIdx: number, blockIdx: number): number {
  let idx = 0;
  for (let g = 0; g < groupIdx; g++) idx += props.groups[g]!.blocks.length;
  return idx + blockIdx;
}

watch(() => props.visible, (v) => {
  if (v) {
    search.value = '';
    selectedIndex.value = 0;
    nextTick(() => {
      (pickerRef.value?.querySelector('.cpub-picker-search') as HTMLInputElement)?.focus();
    });
  }
});

watch(search, () => {
  selectedIndex.value = 0;
});

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredBlocks.value.length - 1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const block = filteredBlocks.value[selectedIndex.value];
    if (block) {
      emit('select', block.type, block.attrs);
    }
    return;
  }
}

function selectBlock(block: BlockTypeDef): void {
  emit('select', block.type, block.attrs);
}

function handleClickOutside(event: MouseEvent): void {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <div v-if="visible" ref="pickerRef" class="cpub-picker" @keydown="handleKeydown">
    <div class="cpub-picker-header">
      <i class="fa-solid fa-magnifying-glass cpub-picker-search-icon"></i>
      <input
        v-model="search"
        type="text"
        class="cpub-picker-search"
        placeholder="Search blocks..."
        aria-label="Search block types"
      />
    </div>
    <div class="cpub-picker-body">
      <!-- Grouped view (no search) -->
      <template v-if="!isSearching && groups.length > 0">
        <template v-for="(group, gi) in groups" :key="group.name">
          <div class="cpub-picker-group-header">{{ group.name }}</div>
          <button
            v-for="(block, bi) in group.blocks"
            :key="block.type + (block.attrs?.variant ?? '')"
            :data-block="block.type"
            class="cpub-picker-item"
            :class="{ 'cpub-picker-item--active': globalIndex(gi, bi) === selectedIndex }"
            @mouseenter="selectedIndex = globalIndex(gi, bi)"
            @click="selectBlock(block)"
          >
            <span class="cpub-picker-icon"><i :class="['fa-solid', block.icon]"></i></span>
            <span class="cpub-picker-text">
              <span class="cpub-picker-label">{{ block.label }}</span>
              <span v-if="block.description" class="cpub-picker-desc">{{ block.description }}</span>
            </span>
          </button>
        </template>
      </template>
      <!-- Flat filtered view (searching) -->
      <template v-else-if="filteredBlocks.length > 0">
        <button
          v-for="(block, i) in filteredBlocks"
          :key="block.type + (block.attrs?.variant ?? '')"
          :data-block="block.type"
          class="cpub-picker-item"
          :class="{ 'cpub-picker-item--active': i === selectedIndex }"
          @mouseenter="selectedIndex = i"
          @click="selectBlock(block)"
        >
          <span class="cpub-picker-icon"><i :class="['fa-solid', block.icon]"></i></span>
          <span class="cpub-picker-text">
            <span class="cpub-picker-label">{{ block.label }}</span>
            <span v-if="block.description" class="cpub-picker-desc">{{ block.description }}</span>
          </span>
        </button>
      </template>
      <div v-else class="cpub-picker-empty">
        No blocks match "{{ search }}"
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-picker {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-lg);
  min-width: 260px;
  max-width: 340px;
  max-height: 360px;
  display: flex;
  flex-direction: column;
}

.cpub-picker-header {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  gap: 8px;
  border-bottom: var(--border-width-default) solid var(--border);
  flex-shrink: 0;
}

.cpub-picker-search-icon {
  font-size: 10px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-picker-search {
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--text);
  width: 100%;
  font-family: var(--font-sans);
}

.cpub-picker-search::placeholder {
  color: var(--text-faint);
}

.cpub-picker-body {
  overflow-y: auto;
  flex: 1;
  padding: 4px;
}

.cpub-picker-group-header {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  padding: 8px 10px 4px;
  margin-top: 2px;
}

.cpub-picker-group-header:first-child {
  margin-top: 0;
}

.cpub-picker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.08s;
  color: var(--text);
  font-size: 12px;
}

.cpub-picker-item:hover,
.cpub-picker-item--active {
  background: var(--accent-bg);
}

.cpub-picker-icon {
  width: 26px;
  height: 26px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-dim);
  flex-shrink: 0;
}

.cpub-picker-item--active .cpub-picker-icon,
.cpub-picker-item:hover .cpub-picker-icon {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

.cpub-picker-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cpub-picker-label {
  font-size: 12px;
  font-weight: 500;
}

.cpub-picker-desc {
  font-size: 10px;
  color: var(--text-faint);
  font-family: var(--font-mono);
}

.cpub-picker-empty {
  padding: 16px;
  text-align: center;
  font-size: 11px;
  color: var(--text-faint);
}

/* Per-block-type icon colors */
[data-block="heading"] .cpub-picker-icon { color: var(--teal); background: color-mix(in srgb, var(--teal) 10%, transparent); }
[data-block="text"] .cpub-picker-icon,
[data-block="paragraph"] .cpub-picker-icon { color: var(--text-dim); background: var(--surface2); }
[data-block="image"] .cpub-picker-icon { color: #38bdf8; background: rgba(56, 189, 248, 0.08); }
[data-block="code"] .cpub-picker-icon,
[data-block="code_block"] .cpub-picker-icon { color: #c084fc; background: rgba(192, 132, 252, 0.08); }
[data-block="callout"] .cpub-picker-icon { color: #fbbf24; background: rgba(251, 191, 36, 0.08); }
[data-block="quote"] .cpub-picker-icon,
[data-block="blockquote"] .cpub-picker-icon { color: #94a3b8; background: rgba(148, 163, 184, 0.08); }
[data-block="embed"] .cpub-picker-icon { color: #f472b6; background: rgba(244, 114, 182, 0.08); }
[data-block="video"] .cpub-picker-icon { color: #fb923c; background: rgba(251, 146, 60, 0.08); }
[data-block="divider"] .cpub-picker-icon,
[data-block="horizontal_rule"] .cpub-picker-icon,
[data-block="horizontalRule"] .cpub-picker-icon { color: var(--text-faint); background: var(--surface2); }
[data-block="gallery"] .cpub-picker-icon { color: #2dd4bf; background: rgba(45, 212, 191, 0.08); }
[data-block="quiz"] .cpub-picker-icon { color: #4ade80; background: rgba(74, 222, 128, 0.08); }
[data-block="slider"] .cpub-picker-icon,
[data-block="interactiveSlider"] .cpub-picker-icon { color: #818cf8; background: rgba(129, 140, 248, 0.08); }
[data-block="math"] .cpub-picker-icon,
[data-block="mathNotation"] .cpub-picker-icon { color: #e879f9; background: rgba(232, 121, 249, 0.08); }
[data-block="markdown"] .cpub-picker-icon { color: var(--text-dim); background: var(--surface2); }
[data-block="buildStep"] .cpub-picker-icon { color: var(--accent); background: var(--accent-bg); }
[data-block="partsList"] .cpub-picker-icon { color: #fb7185; background: rgba(251, 113, 133, 0.08); }
[data-block="toolList"] .cpub-picker-icon { color: #a78bfa; background: rgba(167, 139, 250, 0.08); }
[data-block="downloads"] .cpub-picker-icon { color: #22d3ee; background: rgba(34, 211, 238, 0.08); }
[data-block="sectionHeader"] .cpub-picker-icon { color: var(--accent); background: var(--accent-bg); }
[data-block="checkpoint"] .cpub-picker-icon { color: #34d399; background: rgba(52, 211, 153, 0.08); }
</style>
