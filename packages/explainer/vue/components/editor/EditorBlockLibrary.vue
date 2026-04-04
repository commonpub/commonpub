<script setup lang="ts">
import { ref, computed } from 'vue';
import type { BlockEditor } from '../../composables/useBlockEditor.js';

export interface BlockDef {
  type: string;
  label: string;
  icon?: string;
  description?: string;
  attrs?: Record<string, unknown>;
}

export interface BlockTypeGroup {
  name: string;
  blocks: BlockDef[];
}

const props = defineProps<{
  groups: BlockTypeGroup[];
  blockEditor: BlockEditor;
}>();

const blockSearch = ref('');

const filteredGroups = computed(() => {
  const q = blockSearch.value.toLowerCase();
  if (!q) return props.groups;
  return props.groups
    .map((g) => ({ ...g, blocks: g.blocks.filter((b) => b.label.toLowerCase().includes(q)) }))
    .filter((g) => g.blocks.length > 0);
});

function insertBlock(block: BlockDef): void {
  const selectedId = props.blockEditor.selectedBlockId.value;
  if (selectedId) {
    const idx = props.blockEditor.getBlockIndex(selectedId);
    props.blockEditor.addBlock(block.type, block.attrs, idx + 1);
  } else {
    props.blockEditor.addBlock(block.type, block.attrs);
  }
}
</script>

<template>
  <div class="cpub-block-library">
    <div class="cpub-bl-search">
      <input v-model="blockSearch" type="text" placeholder="Search blocks..." class="cpub-bl-search-input" aria-label="Search blocks" />
    </div>
    <div class="cpub-bl-groups">
      <div v-for="group in filteredGroups" :key="group.name" class="cpub-bl-group">
        <div class="cpub-bl-group-label">{{ group.name }}</div>
        <div class="cpub-bl-blocks">
          <button
            v-for="block in group.blocks"
            :key="block.type + (block.attrs?.variant ?? '')"
            class="cpub-bl-block"
            :title="block.description || block.label"
            @click="insertBlock(block)"
          >
            <span class="cpub-bl-block-icon">{{ block.icon || '+' }}</span>
            <span class="cpub-bl-block-label">{{ block.label }}</span>
          </button>
        </div>
      </div>
      <div v-if="filteredGroups.length === 0" class="cpub-bl-empty">No blocks match "{{ blockSearch }}"</div>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-library { display: flex; flex-direction: column; height: 100%; }
.cpub-bl-search { display: flex; align-items: center; gap: 7px; background: var(--surface2); border: var(--border-width-default) solid var(--border); padding: 5px 9px; margin: 10px 8px 4px; }
.cpub-bl-search-input { background: transparent; border: none; outline: none; font-size: 12px; color: var(--text); width: 100%; }
.cpub-bl-search-input::placeholder { color: var(--text-faint); }
.cpub-bl-groups { flex: 1; overflow-y: auto; padding: 4px 0; }
.cpub-bl-group { padding: 4px 0; }
.cpub-bl-group-label { font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-faint); padding: 6px 12px 4px; }
.cpub-bl-blocks { display: flex; flex-direction: column; gap: 1px; }
.cpub-bl-block { display: flex; align-items: center; gap: 9px; padding: 10px; cursor: pointer; border: var(--border-width-default) solid transparent; background: transparent; color: var(--text-dim); font-size: 12px; user-select: none; transition: background 0.1s; text-align: left; width: 100%; margin: 0 4px; font-family: inherit; }
.cpub-bl-block:hover { background: var(--surface2); border-color: var(--border2); color: var(--text); }
.cpub-bl-block-icon { width: 22px; height: 22px; background: var(--surface3); border: var(--border-width-default) solid var(--border2); display: flex; align-items: center; justify-content: center; font-size: 9px; color: var(--text-faint); flex-shrink: 0; }
.cpub-bl-block:hover .cpub-bl-block-icon { background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent); }
.cpub-bl-block-label { font-size: 11px; flex: 1; }
.cpub-bl-empty { font-size: 11px; color: var(--text-faint); padding: 12px; text-align: center; }
</style>
