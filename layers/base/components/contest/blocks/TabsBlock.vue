<script setup lang="ts">
/**
 * Edit component for the `tabs` block — a tabbed container whose panels each hold
 * nested blocks (the buildStep pattern, generalized). Solves tabbed / multiple
 * rule sets (e.g. Track A vs Track B), each panel a full rich body. House
 * block-edit contract: `content` in, `update` out. Provided via
 * BLOCK_COMPONENTS_KEY. The nested palette (`PANEL_GROUPS`) deliberately omits
 * container blocks so you can't nest tabs-in-tabs.
 */
import type { BlockTuple } from '@commonpub/editor';
import type { BlockTypeGroup } from '@commonpub/editor/vue';
import ContestTabPanel from './ContestTabPanel.vue';

interface TabDef { label: string; blocks: BlockTuple[] }

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

// Blocks offered inside a panel — rich content, but NO container blocks (tabs,
// buildStep) so nesting can't recurse.
const PANEL_GROUPS: BlockTypeGroup[] = [
  { name: 'Basic', blocks: [
    { type: 'paragraph', label: 'Text', icon: 'fa-align-left', description: 'Body text' },
    { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section header' },
    { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or embed' },
    { type: 'code_block', label: 'Code', icon: 'fa-code', description: 'Code block' },
  ] },
  { name: 'Rich', blocks: [
    { type: 'callout', label: 'Tip', icon: 'fa-lightbulb', description: 'Tip callout', attrs: { variant: 'tip' } },
    { type: 'callout', label: 'Warning', icon: 'fa-triangle-exclamation', description: 'Warning callout', attrs: { variant: 'warning' } },
    { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Blockquote' },
    { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Visual separator' },
    { type: 'table', label: 'Table', icon: 'fa-table', description: 'Responsive data table' },
    { type: 'criteriaBar', label: 'Criteria Bar', icon: 'fa-chart-simple', description: 'Weighted criteria bar' },
    { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown block' },
    { type: 'html', label: 'HTML', icon: 'fa-code', description: 'Raw HTML (sanitized on render)' },
  ] },
];

const tabs = computed<TabDef[]>(() =>
  Array.isArray(props.content.tabs)
    ? (props.content.tabs as TabDef[]).map((t) => ({ label: t?.label ?? '', blocks: Array.isArray(t?.blocks) ? t.blocks : [] }))
    : [],
);
const active = ref(0);
watchEffect(() => { if (active.value >= tabs.value.length) active.value = Math.max(0, tabs.value.length - 1); });

function commit(next: TabDef[]): void {
  emit('update', { tabs: next });
}
function setLabel(i: number, label: string): void {
  commit(tabs.value.map((t, idx) => (idx === i ? { ...t, label } : t)));
}
function setBlocks(i: number, blocks: BlockTuple[]): void {
  commit(tabs.value.map((t, idx) => (idx === i ? { ...t, blocks } : t)));
}
function addTab(): void {
  commit([...tabs.value, { label: `Tab ${tabs.value.length + 1}`, blocks: [] }]);
  void nextTick(() => { active.value = tabs.value.length - 1; });
}
function removeTab(i: number): void {
  commit(tabs.value.filter((_, idx) => idx !== i));
}
function moveTab(i: number, dir: -1 | 1): void {
  const j = i + dir;
  if (j < 0 || j >= tabs.value.length) return;
  const next = [...tabs.value];
  [next[i], next[j]] = [next[j]!, next[i]!];
  commit(next);
  active.value = j;
}
</script>

<template>
  <div class="cpub-tabsedit">
    <div class="cpub-tabsedit-header">
      <div class="cpub-tabsedit-icon"><i class="fa-solid fa-folder-tree"></i></div>
      <span class="cpub-tabsedit-title">Tabs</span>
      <span class="cpub-tabsedit-count">{{ tabs.length }} {{ tabs.length === 1 ? 'tab' : 'tabs' }}</span>
      <button type="button" class="cpub-tabsedit-add" @click="addTab"><i class="fa-solid fa-plus"></i> Add tab</button>
    </div>

    <div v-if="tabs.length" class="cpub-tabsedit-bar" role="group" aria-label="Select a tab to edit">
      <div v-for="(t, i) in tabs" :key="i" class="cpub-tabsedit-tab" :class="{ 'cpub-tabsedit-tab-on': active === i }">
        <button type="button" class="cpub-tabsedit-select" :aria-pressed="active === i" @click="active = i">
          {{ t.label || `Tab ${i + 1}` }}
        </button>
      </div>
    </div>

    <div v-if="tabs.length" class="cpub-tabsedit-panel">
      <div class="cpub-tabsedit-meta">
        <input
          class="cpub-tabsedit-label"
          type="text"
          :value="tabs[active]?.label"
          :placeholder="`Tab ${active + 1} label`"
          aria-label="Active tab label"
          @input="setLabel(active, ($event.target as HTMLInputElement).value)"
        />
        <div class="cpub-tabsedit-meta-actions">
          <button type="button" class="cpub-tabsedit-mbtn" :disabled="active === 0" aria-label="Move tab left" title="Move left" @click="moveTab(active, -1)"><i class="fa-solid fa-arrow-left"></i></button>
          <button type="button" class="cpub-tabsedit-mbtn" :disabled="active === tabs.length - 1" aria-label="Move tab right" title="Move right" @click="moveTab(active, 1)"><i class="fa-solid fa-arrow-right"></i></button>
          <button type="button" class="cpub-tabsedit-mbtn cpub-tabsedit-mbtn--danger" aria-label="Remove this tab" title="Remove tab" @click="removeTab(active)"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <!-- One panel editor at a time, keyed by tab so each gets a clean editor;
           parent content persists across switches. -->
      <ContestTabPanel
        :key="active"
        :blocks="tabs[active]?.blocks ?? []"
        :groups="PANEL_GROUPS"
        @update:blocks="setBlocks(active, $event)"
      />
    </div>

    <div v-else class="cpub-tabsedit-empty" @click="addTab"><i class="fa-solid fa-plus"></i> Add the first tab (e.g. Track A, Track B)</div>
  </div>
</template>

<style scoped>
.cpub-tabsedit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-tabsedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-tabsedit-icon { font-size: 12px; color: var(--accent); }
.cpub-tabsedit-title { font-size: 12px; font-weight: 600; }
.cpub-tabsedit-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-tabsedit-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.cpub-tabsedit-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }

.cpub-tabsedit-bar { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 14px 0; }
.cpub-tabsedit-tab { display: inline-flex; }
.cpub-tabsedit-select { font-size: 12px; font-weight: 600; padding: 6px 12px; background: transparent; border: var(--border-width-default) solid var(--border2); border-bottom: none; color: var(--text-dim); cursor: pointer; }
.cpub-tabsedit-tab-on .cpub-tabsedit-select { color: var(--accent); background: var(--accent-bg); border-color: var(--accent-border); }

.cpub-tabsedit-panel { padding: 12px 14px; border-top: var(--border-width-default) solid var(--border2); }
.cpub-tabsedit-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.cpub-tabsedit-label { flex: 1; padding: 6px 8px; font-size: 12px; font-weight: 600; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-tabsedit-label:focus { border-color: var(--accent); }
.cpub-tabsedit-meta-actions { display: inline-flex; gap: 3px; }
.cpub-tabsedit-mbtn { width: 26px; height: 26px; background: var(--surface2); border: var(--border-width-default) solid var(--border2); color: var(--text-faint); cursor: pointer; font-size: 10px; display: inline-flex; align-items: center; justify-content: center; }
.cpub-tabsedit-mbtn:hover:not(:disabled) { color: var(--text); }
.cpub-tabsedit-mbtn:disabled { opacity: 0.35; cursor: not-allowed; }
.cpub-tabsedit-mbtn--danger:hover:not(:disabled) { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }
.cpub-tabsedit-empty { padding: 18px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; margin: 12px 14px; border: var(--border-width-default) dashed var(--border2); }
.cpub-tabsedit-empty:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
</style>
