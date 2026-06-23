<script setup lang="ts">
/**
 * CpubCriteriaBar — the one criteria-weighting visual, shared by the `criteriaBar`
 * block (view + edit preview) and the public "Judging Criteria" section. One thin,
 * seamless, sharp stacked bar (no gaps, no rounding, no in-segment text) where each
 * criterion is a proportional colored segment; all labels live in a legend
 * (swatch · name · share, with an optional description line). The bar is decorative
 * (aria-hidden); the legend + an sr-only summary carry the data. Pattern: the
 * iOS-storage / GitHub-language bar — distinct categorical colors, external legend.
 */
import { criteriaBar, type CriteriaBarItem } from '../utils/contestBlocks';

// NB: boolean props cast an absent value to `false` (Vue boolean casting), so the
// legend must default true explicitly — otherwise callers that omit it lose the legend.
const props = withDefaults(
  defineProps<{
    items?: CriteriaBarItem[];
    heading?: string;
    showLegend?: boolean;
  }>(),
  { items: () => [], heading: '', showLegend: true },
);

const data = computed(() => criteriaBar(props.items));
const segments = computed(() => data.value.rows.filter((r) => r.pct > 0));
const showLegend = computed(() => props.showLegend);
const hasDesc = computed(() => data.value.rows.some((r) => r.description));
const summary = computed(() =>
  data.value.rows.map((r) => (data.value.total > 0 ? `${r.label} ${r.pct}%` : r.label)).join(', '),
);
</script>

<template>
  <figure v-if="data.rows.length" class="cpub-cbar" role="group" :aria-label="heading || 'Criteria weighting'">
    <figcaption v-if="heading" class="cpub-cbar-heading">{{ heading }}</figcaption>

    <div v-if="segments.length" class="cpub-cbar-track" aria-hidden="true">
      <span
        v-for="(s, i) in segments"
        :key="i"
        class="cpub-cbar-seg"
        :style="{ width: `${s.pct}%`, background: s.colorVar }"
        :title="`${s.label} — ${s.pct}%`"
      />
    </div>

    <ul v-if="showLegend" class="cpub-cbar-legend" :class="{ 'cpub-cbar-legend--rows': hasDesc }">
      <li v-for="(r, i) in data.rows" :key="i" class="cpub-cbar-li">
        <span class="cpub-cbar-dot" :style="{ background: r.colorVar }" aria-hidden="true" />
        <span class="cpub-cbar-name">{{ r.label }}</span>
        <span v-if="data.total > 0" class="cpub-cbar-val">{{ r.pct }}%</span>
        <span v-if="r.description" class="cpub-cbar-desc">{{ r.description }}</span>
      </li>
    </ul>

    <span class="cpub-sr-only">Criteria weighting: {{ summary }}.</span>
  </figure>
</template>

<style scoped>
.cpub-cbar { margin: 0; }
.cpub-cbar-heading { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); margin: 0 0 8px; }

/* The bar: thin, seamless (segments butt edge-to-edge), sharp (no radius leak). */
.cpub-cbar-track {
  display: flex; width: 100%; height: 10px; overflow: hidden;
  border-radius: 0; background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
}
.cpub-cbar-seg { height: 100%; min-width: 2px; border-radius: 0; }

/* Legend — compact wrap by default; one row per item when descriptions exist. */
.cpub-cbar-legend { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 18px; }
.cpub-cbar-li { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.cpub-cbar-dot { width: 10px; height: 10px; flex-shrink: 0; border-radius: 0; border: var(--border-width-default) solid var(--border2); }
.cpub-cbar-name { font-size: 12px; color: var(--text); font-weight: 600; }
.cpub-cbar-val { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-cbar-desc { display: none; }

/* Rows mode: a scannable list with the weight right-aligned + a description line. */
.cpub-cbar-legend--rows { flex-direction: column; gap: 12px; }
.cpub-cbar-legend--rows .cpub-cbar-li { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 3px 10px; width: 100%; }
.cpub-cbar-legend--rows .cpub-cbar-dot { align-self: center; }
.cpub-cbar-legend--rows .cpub-cbar-val { justify-self: end; }
.cpub-cbar-legend--rows .cpub-cbar-desc { display: block; grid-column: 2 / -1; font-size: 12px; color: var(--text-dim); line-height: 1.5; }

.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
</style>
