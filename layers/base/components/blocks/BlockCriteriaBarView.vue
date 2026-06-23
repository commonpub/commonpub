<script setup lang="ts">
/**
 * Read-only view for the `criteriaBar` block — judging criteria as ONE stacked
 * horizontal bar, each criterion a proportional colored segment, with an
 * accessible legend (swatch · label · weight · share). The bar is decorative
 * (aria-hidden); the legend carries the data for screen readers.
 */
import { criteriaSegments, type CriteriaBarItem } from '../../utils/contestBlocks';

const props = defineProps<{
  content: { heading?: string; items?: CriteriaBarItem[]; showLegend?: boolean };
}>();

const data = computed(() => criteriaSegments(props.content.items));
const showLegend = computed(() => props.content.showLegend !== false);
const summary = computed(() =>
  data.value.segments.map((s) => `${s.label} ${s.pct}%`).join(', '),
);
</script>

<template>
  <figure v-if="data.segments.length" class="cpub-cbar" role="group" :aria-label="content.heading || 'Judging criteria'">
    <figcaption v-if="content.heading" class="cpub-cbar-heading">{{ content.heading }}</figcaption>

    <div class="cpub-cbar-track" aria-hidden="true">
      <div
        v-for="(s, i) in data.segments"
        :key="i"
        class="cpub-cbar-seg"
        :style="{ width: `${s.pct}%`, background: s.colorVar }"
        :title="`${s.label} — ${s.weight} (${s.pct}%)`"
      >
        <span v-if="s.pct >= 12" class="cpub-cbar-seg-label">{{ s.label }}<span class="cpub-cbar-seg-pct"> {{ s.pct }}%</span></span>
      </div>
    </div>

    <ul v-if="showLegend" class="cpub-cbar-legend">
      <li v-for="(s, i) in data.segments" :key="i" class="cpub-cbar-legend-item">
        <span class="cpub-cbar-swatch" :style="{ background: s.colorVar }" aria-hidden="true"></span>
        <span class="cpub-cbar-legend-label">{{ s.label }}</span>
        <span class="cpub-cbar-legend-weight">{{ s.weight }} <span class="cpub-cbar-legend-pct">({{ s.pct }}%)</span></span>
      </li>
    </ul>
    <span class="cpub-sr-only">Criteria weighting: {{ summary }}.</span>
  </figure>
</template>

<style scoped>
.cpub-cbar { margin: 0 0 18px; }
.cpub-cbar-heading { font-size: 13px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); margin: 0 0 10px; }
.cpub-cbar-track {
  display: flex; width: 100%; height: 34px; overflow: hidden;
  border: var(--border-width-default) solid var(--border); background: var(--surface2);
}
.cpub-cbar-seg {
  height: 100%; min-width: 3px; display: flex; align-items: center; justify-content: center;
  overflow: hidden; border-right: var(--border-width-default) solid var(--surface);
  transition: width 0.2s;
}
.cpub-cbar-seg:last-child { border-right: none; }
.cpub-cbar-seg-label {
  font-size: 11px; font-weight: 700; color: var(--color-text-inverse);
  white-space: nowrap; padding: 0 6px; overflow: hidden; text-overflow: ellipsis;
  text-shadow: 0 1px 2px var(--color-surface-scrim, rgba(0,0,0,.35));
}
.cpub-cbar-seg-pct { font-weight: 600; opacity: 0.92; }
.cpub-cbar-legend { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 18px; }
.cpub-cbar-legend-item { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-dim); }
.cpub-cbar-swatch { width: 12px; height: 12px; flex-shrink: 0; border: var(--border-width-default) solid var(--border2); }
.cpub-cbar-legend-label { color: var(--text); font-weight: 600; }
.cpub-cbar-legend-weight { color: var(--text-faint); font-family: var(--font-mono); font-size: 11px; }
.cpub-cbar-legend-pct { color: var(--text-faint); }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
</style>
