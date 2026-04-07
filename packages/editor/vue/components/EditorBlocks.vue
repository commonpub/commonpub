<script setup lang="ts">
/**
 * Reusable block library sidebar for editors.
 * Renders a searchable list of insertable blocks grouped by category.
 * Clicking a block adds it to the end of the document via the block editor composable.
 */
import { ref, computed } from 'vue';
import type { BlockDef, BlockGroup } from '../types.js';
import type { BlockEditor } from '../composables/useBlockEditor.js';

const props = defineProps<{
  groups: BlockGroup[];
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
      <i class="fa-solid fa-magnifying-glass cpub-bl-search-icon"></i>
      <input
        v-model="blockSearch"
        type="text"
        placeholder="Search blocks..."
        class="cpub-bl-search-input"
        aria-label="Search blocks"
      />
    </div>
    <div class="cpub-bl-groups">
      <div v-for="group in filteredGroups" :key="group.name" class="cpub-bl-group">
        <div class="cpub-bl-group-label">{{ group.name }}</div>
        <div class="cpub-bl-blocks">
          <button
            v-for="block in group.blocks"
            :key="block.type + (block.attrs?.variant ?? '')"
            :data-block="block.type"
            class="cpub-bl-block"
            :class="group.variant"
            :title="block.label"
            @click="insertBlock(block)"
          >
            <span class="cpub-bl-block-icon"><i :class="['fa-solid', block.icon]"></i></span>
            <span class="cpub-bl-block-label">{{ block.label }}</span>
            <span class="cpub-bl-block-drag"><i class="fa-solid fa-grip-dots-vertical"></i></span>
          </button>
        </div>
      </div>
      <div v-if="filteredGroups.length === 0" class="cpub-bl-empty">
        No blocks match "{{ blockSearch }}"
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-library {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cpub-bl-search {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  padding: 5px 9px;
  margin: 10px 8px 4px;
}

.cpub-bl-search-icon {
  font-size: 10px;
  color: var(--text-faint);
  flex-shrink: 0;
}

.cpub-bl-search-input {
  background: transparent;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--text);
  width: 100%;
}

.cpub-bl-search-input::placeholder {
  color: var(--text-faint);
}

.cpub-bl-groups {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.cpub-bl-group {
  padding: 4px 0;
}

.cpub-bl-group-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-faint);
  padding: 6px 12px 4px;
}

.cpub-bl-blocks {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cpub-bl-block {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 10px;
  cursor: pointer;
  border: var(--border-width-default) solid transparent;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  user-select: none;
  transition: background 0.1s;
  text-align: left;
  width: 100%;
  margin: 0 4px;
}

.cpub-bl-block:hover {
  background: var(--surface2);
  border-color: var(--border2);
  color: var(--text);
}

.cpub-bl-block-icon {
  width: 22px;
  height: 22px;
  background: var(--surface3);
  border: var(--border-width-default) solid var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: var(--text-faint);
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}

.cpub-bl-block:hover .cpub-bl-block-icon {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  color: var(--accent);
}

.cpub-bl-block-label {
  font-size: 11px;
  flex: 1;
}

.cpub-bl-block-drag {
  font-size: 9px;
  color: var(--text-faint);
  opacity: 0;
  transition: opacity 0.1s;
}

.cpub-bl-block:hover .cpub-bl-block-drag {
  opacity: 1;
}

.cpub-bl-empty {
  font-size: 11px;
  color: var(--text-faint);
  padding: 12px;
  text-align: center;
}

@media (hover: none) {
  .cpub-bl-block-drag { opacity: 1; }
}

/* Per-block-type icon colors */
[data-block="heading"] .cpub-bl-block-icon { color: var(--teal); background: color-mix(in srgb, var(--teal) 10%, transparent); }
[data-block="text"] .cpub-bl-block-icon,
[data-block="paragraph"] .cpub-bl-block-icon { color: var(--text-dim); background: var(--surface2); }
[data-block="image"] .cpub-bl-block-icon { color: #38bdf8; background: rgba(56, 189, 248, 0.08); }
[data-block="code"] .cpub-bl-block-icon,
[data-block="code_block"] .cpub-bl-block-icon { color: #c084fc; background: rgba(192, 132, 252, 0.08); }
[data-block="callout"] .cpub-bl-block-icon { color: #fbbf24; background: rgba(251, 191, 36, 0.08); }
[data-block="quote"] .cpub-bl-block-icon,
[data-block="blockquote"] .cpub-bl-block-icon { color: #94a3b8; background: rgba(148, 163, 184, 0.08); }
[data-block="embed"] .cpub-bl-block-icon { color: #f472b6; background: rgba(244, 114, 182, 0.08); }
[data-block="video"] .cpub-bl-block-icon { color: #fb923c; background: rgba(251, 146, 60, 0.08); }
[data-block="divider"] .cpub-bl-block-icon,
[data-block="horizontal_rule"] .cpub-bl-block-icon,
[data-block="horizontalRule"] .cpub-bl-block-icon { color: var(--text-faint); background: var(--surface2); }
[data-block="gallery"] .cpub-bl-block-icon { color: #2dd4bf; background: rgba(45, 212, 191, 0.08); }
[data-block="quiz"] .cpub-bl-block-icon { color: #4ade80; background: rgba(74, 222, 128, 0.08); }
[data-block="slider"] .cpub-bl-block-icon,
[data-block="interactiveSlider"] .cpub-bl-block-icon { color: #818cf8; background: rgba(129, 140, 248, 0.08); }
[data-block="math"] .cpub-bl-block-icon,
[data-block="mathNotation"] .cpub-bl-block-icon { color: #e879f9; background: rgba(232, 121, 249, 0.08); }
[data-block="markdown"] .cpub-bl-block-icon { color: var(--text-dim); background: var(--surface2); }
[data-block="buildStep"] .cpub-bl-block-icon { color: var(--accent); background: var(--accent-bg); }
[data-block="partsList"] .cpub-bl-block-icon { color: #fb7185; background: rgba(251, 113, 133, 0.08); }
[data-block="toolList"] .cpub-bl-block-icon { color: #a78bfa; background: rgba(167, 139, 250, 0.08); }
[data-block="downloads"] .cpub-bl-block-icon { color: #22d3ee; background: rgba(34, 211, 238, 0.08); }
[data-block="sectionHeader"] .cpub-bl-block-icon { color: var(--accent); background: var(--accent-bg); }
[data-block="checkpoint"] .cpub-bl-block-icon { color: #34d399; background: rgba(52, 211, 153, 0.08); }
</style>
