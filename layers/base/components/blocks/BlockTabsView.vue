<script setup lang="ts">
/**
 * Read-only view for the `tabs` block — tabbed container, each panel a nested
 * BlockTuple[] rendered recursively (via the auto-import name
 * `BlocksBlockContentRenderer`, since this view and the renderer are mutually
 * recursive). Replaces the hand-built CSS radio-tabs (e.g. Track A / Track B
 * rules) with an accessible WAI-ARIA tablist (roving tabindex + arrow keys).
 * All panels stay in the DOM (v-show) so nested content is crawlable.
 */
import { useId } from 'vue';
import type { BlockTuple } from '@commonpub/editor';

interface TabDef { label: string; blocks: BlockTuple[] }
const props = defineProps<{ content: { tabs?: TabDef[] } }>();

const tabs = computed<TabDef[]>(() =>
  (props.content.tabs ?? []).filter((t) => t && Array.isArray(t.blocks)),
);
const active = ref(0);
watchEffect(() => { if (active.value >= tabs.value.length) active.value = 0; });

const uid = useId();
const tabId = (i: number): string => `${uid}-tab-${i}`;
const panelId = (i: number): string => `${uid}-panel-${i}`;

function onKey(e: KeyboardEvent, i: number): void {
  const n = tabs.value.length;
  let next: number | null = null;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = n - 1;
  if (next === null) return;
  e.preventDefault();
  active.value = next;
  void nextTick(() => { if (typeof document !== 'undefined') document.getElementById(tabId(next!))?.focus(); });
}
</script>

<template>
  <div v-if="tabs.length" class="cpub-tabs">
    <div class="cpub-tabs-list" role="tablist">
      <button
        v-for="(t, i) in tabs"
        :id="tabId(i)"
        :key="i"
        type="button"
        role="tab"
        :aria-selected="active === i"
        :aria-controls="panelId(i)"
        :tabindex="active === i ? 0 : -1"
        class="cpub-tabs-tab"
        :class="{ 'cpub-tabs-tab-active': active === i }"
        @click="active = i"
        @keydown="onKey($event, i)"
      >{{ t.label || `Tab ${i + 1}` }}</button>
    </div>
    <div
      v-for="(t, i) in tabs"
      v-show="active === i"
      :id="panelId(i)"
      :key="i"
      role="tabpanel"
      :aria-labelledby="tabId(i)"
      tabindex="0"
      class="cpub-tabs-panel"
    >
      <BlocksBlockContentRenderer :blocks="t.blocks" class="cpub-prose cpub-md" />
    </div>
  </div>
</template>

<style scoped>
.cpub-tabs { margin: 0 0 18px; }
.cpub-tabs-list { display: flex; flex-wrap: wrap; gap: 6px; border-bottom: 2px solid var(--border); margin-bottom: 20px; }
.cpub-tabs-tab {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  font-weight: 700; font-size: 13px; color: var(--text-faint);
  background: transparent; border: var(--border-width-default) solid transparent; border-bottom: none;
  padding: 10px 16px; margin-bottom: -2px;
}
.cpub-tabs-tab:hover { color: var(--text); }
.cpub-tabs-tab-active { color: var(--accent); background: var(--accent-bg); border-color: var(--accent-border); }
.cpub-tabs-panel:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
