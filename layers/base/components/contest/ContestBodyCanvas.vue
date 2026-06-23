<script setup lang="ts">
/**
 * ContestBodyCanvas — the CENTER of the contest editor shell: a tab bar
 * (Overview / Rules / Prizes) + a Write/Preview/Code switch over a SINGLE shared
 * BlockCanvas. Presentational only — it owns no block state; the parent
 * (ContestEditor) holds the three hoisted useBlockEditor instances and passes the
 * currently-active one as `editor`, so the left palette and this canvas target the
 * same body. `activeTab` + `mode` are v-modelled back to the parent (the palette
 * needs `activeTab` to resolve which body it inserts into).
 *
 * Write = the canvas · Preview = the same blocks through the public view renderer ·
 * Code = read-only BlockTuple[] JSON, all derived from the active editor.
 */
import { BlockCanvas, type BlockEditor, type BlockTypeGroup } from '@commonpub/editor/vue';

type BodyTab = 'overview' | 'rules' | 'prizes';
type BodyMode = 'write' | 'preview' | 'code';

const props = defineProps<{
  editor: BlockEditor;
  groups: BlockTypeGroup[];
  activeTab: BodyTab;
  mode: BodyMode;
}>();

const emit = defineEmits<{
  'update:activeTab': [tab: BodyTab];
  'update:mode': [mode: BodyMode];
}>();

const TABS: { key: BodyTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'fa-circle-info' },
  { key: 'rules', label: 'Rules', icon: 'fa-file-lines' },
  { key: 'prizes', label: 'Prizes', icon: 'fa-trophy' },
];
const MODES: { key: BodyMode; label: string; icon: string }[] = [
  { key: 'write', label: 'Write', icon: 'fa-pen' },
  { key: 'preview', label: 'Preview', icon: 'fa-eye' },
  { key: 'code', label: 'Code', icon: 'fa-code' },
];

// Live tuples for Preview/Code — recomputes when the active editor's blocks change
// or when the editor prop swaps on a tab switch.
const previewBlocks = computed<[string, Record<string, unknown>][]>(
  () => props.editor.toBlockTuples() as [string, Record<string, unknown>][],
);
const codeJson = computed<string>(() => JSON.stringify(previewBlocks.value, null, 2));

// Roving-arrow keyboard nav for the tablist (WCAG).
function onTabKey(e: KeyboardEvent, key: BodyTab): void {
  const i = TABS.findIndex((t) => t.key === key);
  if (i < 0) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); emit('update:activeTab', TABS[(i + 1) % TABS.length]!.key); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); emit('update:activeTab', TABS[(i - 1 + TABS.length) % TABS.length]!.key); }
  else if (e.key === 'Home') { e.preventDefault(); emit('update:activeTab', TABS[0]!.key); }
  else if (e.key === 'End') { e.preventDefault(); emit('update:activeTab', TABS[TABS.length - 1]!.key); }
}
</script>

<template>
  <div class="cpub-cbc">
    <div class="cpub-cbc-bar">
      <div class="cpub-cbc-tablist" role="tablist" aria-label="Contest body sections">
        <button
          v-for="t in TABS"
          :id="`cpub-cbc-tab-${t.key}`"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === t.key"
          :tabindex="activeTab === t.key ? 0 : -1"
          class="cpub-cbc-tab"
          :class="{ 'cpub-cbc-tab-active': activeTab === t.key }"
          @click="emit('update:activeTab', t.key)"
          @keydown="onTabKey($event, t.key)"
        >
          <i class="fa-solid" :class="t.icon"></i> {{ t.label }}
        </button>
      </div>
      <div class="cpub-cbc-mode" role="group" aria-label="Body view mode">
        <button
          v-for="m in MODES"
          :key="m.key"
          type="button"
          class="cpub-cbc-mode-btn"
          :class="{ 'cpub-cbc-mode-active': mode === m.key }"
          :aria-pressed="mode === m.key"
          @click="emit('update:mode', m.key)"
        >
          <i class="fa-solid" :class="m.icon"></i> {{ m.label }}
        </button>
      </div>
    </div>

    <div class="cpub-cbc-panel" role="tabpanel" :aria-labelledby="`cpub-cbc-tab-${activeTab}`">
      <!-- Overview-only lead (inline banner + cover); the parent fills the slot. -->
      <div v-if="activeTab === 'overview' && mode === 'write'" class="cpub-cbc-lead">
        <slot name="overview-lead" />
      </div>
      <!-- One canvas, keyed by tab so each body gets a clean canvas instance; the
           underlying block state persists in the parent's hoisted editors. -->
      <BlockCanvas v-show="mode === 'write'" :key="activeTab" :block-editor="editor" :block-types="groups" />
      <div v-if="mode === 'preview'" class="cpub-cbc-preview">
        <BlocksBlockContentRenderer v-if="previewBlocks.length" :blocks="previewBlocks" class="cpub-prose cpub-md" />
        <p v-else class="cpub-cbc-empty">Nothing to preview yet. Switch to Write and add some blocks.</p>
      </div>
      <pre v-else-if="mode === 'code'" class="cpub-cbc-code" aria-label="Block content as JSON"><code>{{ codeJson }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.cpub-cbc { display: flex; flex-direction: column; }
.cpub-cbc-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-3); border-bottom: var(--border-width-default) solid var(--border); }
.cpub-cbc-tablist { display: flex; gap: 4px; }
.cpub-cbc-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; background: transparent; border: none; cursor: pointer;
  font-size: var(--text-sm); font-weight: 600; color: var(--text-dim);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.cpub-cbc-tab:hover { color: var(--text); }
.cpub-cbc-tab-active { color: var(--accent); border-bottom-color: var(--accent); }

.cpub-cbc-mode { display: inline-flex; margin-bottom: 6px; border: var(--border-width-default) solid var(--border); }
.cpub-cbc-mode-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; background: transparent; border: none; cursor: pointer;
  font-size: var(--text-xs); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-faint); border-right: var(--border-width-default) solid var(--border);
}
.cpub-cbc-mode-btn:last-child { border-right: none; }
.cpub-cbc-mode-btn:hover { background: var(--surface2); color: var(--text-dim); }
.cpub-cbc-mode-active { background: var(--accent-bg); color: var(--accent); }

.cpub-cbc-panel { border: var(--border-width-default) solid var(--border); background: var(--surface); padding: var(--space-2); }
.cpub-cbc-lead { margin-bottom: var(--space-3); }
.cpub-cbc-preview { padding: var(--space-3); }
.cpub-cbc-empty { font-size: var(--text-sm); color: var(--text-faint); margin: 0; padding: var(--space-4) 0; text-align: center; }
.cpub-cbc-code {
  margin: 0; padding: var(--space-3); overflow: auto; max-height: 60vh;
  background: var(--surface2); color: var(--text-dim);
  font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.6;
  white-space: pre; tab-size: 2;
}
</style>
