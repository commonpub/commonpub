<script setup lang="ts">
/**
 * Block type picker — appears when clicking an insert zone.
 * Shows available block types grouped by category, with search.
 */
export interface BlockTypeDef {
  type: string;
  label: string;
  icon: string;
  description?: string;
  attrs?: Record<string, unknown>;
}

export interface BlockTypeGroup {
  name: string;
  blocks: BlockTypeDef[];
}

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

const filteredBlocks = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return flatBlocks.value;
  return flatBlocks.value.filter(
    (b) => b.label.toLowerCase().includes(q) || b.type.toLowerCase().includes(q),
  );
});

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

// Close on click outside
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
      <template v-if="filteredBlocks.length > 0">
        <button
          v-for="(block, i) in filteredBlocks"
          :key="block.type + (block.attrs?.variant ?? '')"
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
  border: 2px solid var(--border);
  box-shadow: 6px 6px 0 var(--border);
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
  border-bottom: 2px solid var(--border);
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
  border: 2px solid var(--border2);
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
</style>
