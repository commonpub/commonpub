<script setup lang="ts">
/**
 * Tabbed contest body editor: Overview | Rules | Prizes — each a ContestBodyEditor
 * (house block editor). The body of the contest editor shell; the organizer toggles
 * which long-form field they're editing. v-models the three BlockTuple[] arrays and
 * passes the legacy markdown/html for convert-on-edit. All three stay mounted
 * (v-show) so block state + undo history survive tab switches.
 */
type Fmt = 'markdown' | 'html' | null;
interface Tab { key: string; label: string; icon: string }

const props = defineProps<{
  description?: unknown[] | null;
  rules?: unknown[] | null;
  prizes?: unknown[] | null;
  legacyDescription?: string | null;
  legacyDescriptionFormat?: Fmt;
  legacyRules?: string | null;
  legacyRulesFormat?: Fmt;
  legacyPrizes?: string | null;
  legacyPrizesFormat?: Fmt;
  /** Extra full-width canvas tabs (e.g. Stages, Judging) for non-body editors;
   *  each tab's content is supplied via a slot named after its `key`. Keeps this
   *  component decoupled from those editors' logic. */
  extraTabs?: Tab[];
}>();

const emit = defineEmits<{
  'update:description': [v: unknown[]];
  'update:rules': [v: unknown[]];
  'update:prizes': [v: unknown[]];
}>();

const BODY_TABS: Tab[] = [
  { key: 'overview', label: 'Overview', icon: 'fa-circle-info' },
  { key: 'rules', label: 'Rules', icon: 'fa-file-lines' },
  { key: 'prizes', label: 'Prizes', icon: 'fa-trophy' },
];
const tabs = computed<Tab[]>(() => [...BODY_TABS, ...(props.extraTabs ?? [])]);
const active = ref<string>('overview');

// Roving-arrow keyboard nav for the tablist (WCAG).
function onKey(e: KeyboardEvent, key: string): void {
  const list = tabs.value;
  const i = list.findIndex((t) => t.key === key);
  if (i < 0) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); active.value = list[(i + 1) % list.length]!.key; }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); active.value = list[(i - 1 + list.length) % list.length]!.key; }
  else if (e.key === 'Home') { e.preventDefault(); active.value = list[0]!.key; }
  else if (e.key === 'End') { e.preventDefault(); active.value = list[list.length - 1]!.key; }
}
</script>

<template>
  <div class="cpub-body-tabs">
    <div class="cpub-body-tablist" role="tablist" aria-label="Contest body sections">
      <button
        v-for="t in tabs"
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
    <template v-for="t in (extraTabs ?? [])" :key="t.key">
      <div v-show="active === t.key" role="tabpanel" :aria-labelledby="`cpub-body-tab-${t.key}`">
        <slot :name="t.key" />
      </div>
    </template>
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
