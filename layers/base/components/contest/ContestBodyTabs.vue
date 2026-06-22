<script setup lang="ts">
/**
 * Tabbed contest body editor: Overview | Rules | Prizes — each a ContestBodyEditor
 * (house block editor). The body of the contest editor shell; the organizer toggles
 * which long-form field they're editing. v-models the three BlockTuple[] arrays and
 * passes the legacy markdown/html for convert-on-edit. All three stay mounted
 * (v-show) so block state + undo history survive tab switches.
 */
type Fmt = 'markdown' | 'html' | null;

defineProps<{
  description?: unknown[] | null;
  rules?: unknown[] | null;
  prizes?: unknown[] | null;
  legacyDescription?: string | null;
  legacyDescriptionFormat?: Fmt;
  legacyRules?: string | null;
  legacyRulesFormat?: Fmt;
  legacyPrizes?: string | null;
  legacyPrizesFormat?: Fmt;
}>();

const emit = defineEmits<{
  'update:description': [v: unknown[]];
  'update:rules': [v: unknown[]];
  'update:prizes': [v: unknown[]];
}>();

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'fa-circle-info' },
  { key: 'rules', label: 'Rules', icon: 'fa-file-lines' },
  { key: 'prizes', label: 'Prizes', icon: 'fa-trophy' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const active = ref<TabKey>('overview');

// Roving-arrow keyboard nav for the tablist (WCAG).
function onKey(e: KeyboardEvent, key: TabKey): void {
  const i = TABS.findIndex((t) => t.key === key);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); active.value = TABS[(i + 1) % TABS.length]!.key; }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); active.value = TABS[(i - 1 + TABS.length) % TABS.length]!.key; }
  else if (e.key === 'Home') { e.preventDefault(); active.value = TABS[0]!.key; }
  else if (e.key === 'End') { e.preventDefault(); active.value = TABS[TABS.length - 1]!.key; }
}
</script>

<template>
  <div class="cpub-body-tabs">
    <div class="cpub-body-tablist" role="tablist" aria-label="Contest body sections">
      <button
        v-for="t in TABS"
        :id="`cpub-body-tab-${t.key}`"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="active === t.key"
        :tabindex="active === t.key ? 0 : -1"
        class="cpub-body-tab"
        :class="{ 'cpub-body-tab-active': active === t.key }"
        @click="active = t.key"
        @keydown="onKey($event, t.key)"
      >
        <i class="fa-solid" :class="t.icon"></i> {{ t.label }}
      </button>
    </div>

    <div v-show="active === 'overview'" role="tabpanel" aria-labelledby="cpub-body-tab-overview">
      <ContestBodyEditor :model-value="description" :legacy="legacyDescription" :legacy-format="legacyDescriptionFormat" @update:model-value="emit('update:description', $event)" />
    </div>
    <div v-show="active === 'rules'" role="tabpanel" aria-labelledby="cpub-body-tab-rules">
      <ContestBodyEditor :model-value="rules" :legacy="legacyRules" :legacy-format="legacyRulesFormat" @update:model-value="emit('update:rules', $event)" />
    </div>
    <div v-show="active === 'prizes'" role="tabpanel" aria-labelledby="cpub-body-tab-prizes">
      <ContestBodyEditor :model-value="prizes" :legacy="legacyPrizes" :legacy-format="legacyPrizesFormat" @update:model-value="emit('update:prizes', $event)" />
    </div>
  </div>
</template>

<style scoped>
.cpub-body-tablist { display: flex; gap: 4px; margin-bottom: var(--space-3); border-bottom: var(--border-width-default) solid var(--border); }
.cpub-body-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; background: transparent; border: none; cursor: pointer;
  font-size: var(--text-sm); font-weight: 600; color: var(--text-dim);
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.cpub-body-tab:hover { color: var(--text); }
.cpub-body-tab-active { color: var(--accent); border-bottom-color: var(--accent); }
</style>
