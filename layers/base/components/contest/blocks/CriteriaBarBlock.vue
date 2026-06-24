<script setup lang="ts">
/**
 * Edit component for the `criteriaBar` block — judging criteria as one stacked
 * weighted bar. Rows of {label, weight, color}, an optional heading, a legend
 * toggle, and a live preview of the bar. House block-edit contract: `content`
 * in, `update` out. Provided via BLOCK_COMPONENTS_KEY.
 */
import { inject } from 'vue';
import { CRITERIA_BAR_PALETTE, CONTEST_RUBRIC_KEY, criteriaBar, type CriteriaBarItem } from '../../../utils/contestBlocks';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

// The contest editor provides its live judging rubric; offer a one-click fill.
const rubric = inject(CONTEST_RUBRIC_KEY, null);
const canUseRubric = computed(() => !!rubric?.value?.some((c) => (c.label ?? '').trim()));

const heading = computed(() => (typeof props.content.heading === 'string' ? props.content.heading : ''));
const items = computed<CriteriaBarItem[]>(() => (Array.isArray(props.content.items) ? (props.content.items as CriteriaBarItem[]) : []));
const showLegend = computed(() => props.content.showLegend !== false);
const preview = computed(() => criteriaBar(items.value));

function commit(next: Partial<{ heading: string; items: CriteriaBarItem[]; showLegend: boolean }>): void {
  emit('update', { heading: heading.value || undefined, items: items.value, showLegend: showLegend.value, ...next });
}
function addItem(): void {
  commit({ items: [...items.value, { label: '', weight: 10, color: CRITERIA_BAR_PALETTE[items.value.length % CRITERIA_BAR_PALETTE.length]! }] });
}
function setItem(i: number, field: keyof CriteriaBarItem, value: string | number): void {
  commit({ items: items.value.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)) });
}
function removeItem(i: number): void {
  commit({ items: items.value.filter((_, idx) => idx !== i) });
}
function useRubric(): void {
  const src = (rubric?.value ?? []).filter((c) => (c.label ?? '').trim());
  commit({ items: src.map((c, i) => ({ label: c.label.trim(), weight: Number(c.weight) || 0, color: CRITERIA_BAR_PALETTE[i % CRITERIA_BAR_PALETTE.length]! })) });
}
</script>

<template>
  <div class="cpub-cbedit">
    <div class="cpub-cbedit-header">
      <div class="cpub-cbedit-icon"><i class="fa-solid fa-chart-simple"></i></div>
      <span class="cpub-cbedit-title">Criteria Bar</span>
      <span class="cpub-cbedit-total">{{ preview.total }} total</span>
      <button v-if="canUseRubric" type="button" class="cpub-cbedit-add" title="Fill from this contest's judging rubric" @click="useRubric"><i class="fa-solid fa-wand-magic-sparkles"></i> Use rubric</button>
      <button type="button" class="cpub-cbedit-add" @click="addItem"><i class="fa-solid fa-plus"></i> Add criterion</button>
    </div>

    <div class="cpub-cbedit-body">
      <input
        class="cpub-cbedit-input cpub-cbedit-heading"
        type="text"
        :value="heading"
        placeholder="Heading (optional), e.g. Final evaluation"
        aria-label="Criteria bar heading"
        @input="commit({ heading: ($event.target as HTMLInputElement).value || undefined })"
      />

      <!-- Live preview (the real shared bar — WYSIWYG) -->
      <div v-if="preview.rows.length" class="cpub-cbedit-preview">
        <CpubCriteriaBar :items="items" :show-legend="showLegend" />
      </div>

      <div v-for="(it, i) in items" :key="i" class="cpub-cbedit-row">
        <input class="cpub-cbedit-input cpub-cbedit-label" type="text" :value="it.label" placeholder="Criterion (e.g. Innovation)" :aria-label="`Criterion ${i + 1} label`" @input="setItem(i, 'label', ($event.target as HTMLInputElement).value)" />
        <input class="cpub-cbedit-input cpub-cbedit-weight" type="number" min="0" :value="it.weight" :aria-label="`Criterion ${i + 1} weight`" @input="setItem(i, 'weight', Number(($event.target as HTMLInputElement).value))" />
        <div class="cpub-cbedit-colors" role="group" :aria-label="`Criterion ${i + 1} color`">
          <button
            v-for="c in CRITERIA_BAR_PALETTE"
            :key="c"
            type="button"
            class="cpub-cbedit-swatch"
            :class="{ 'cpub-cbedit-swatch-on': (it.color || '') === c }"
            :style="{ background: `var(--${c})` }"
            :title="c"
            :aria-label="`Use ${c}`"
            :aria-pressed="(it.color || '') === c"
            @click="setItem(i, 'color', c)"
          ></button>
        </div>
        <button type="button" class="cpub-cbedit-remove" :aria-label="`Remove criterion ${i + 1}`" @click="removeItem(i)"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div v-if="!items.length" class="cpub-cbedit-empty" @click="addItem"><i class="fa-solid fa-plus"></i> Add the first criterion</div>

      <label class="cpub-cbedit-check"><input type="checkbox" :checked="showLegend" @change="commit({ showLegend: ($event.target as HTMLInputElement).checked })" /> <span>Show color legend</span></label>
    </div>
  </div>
</template>

<style scoped>
.cpub-cbedit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-cbedit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-cbedit-icon { font-size: 12px; color: var(--accent); }
.cpub-cbedit-title { font-size: 12px; font-weight: 600; }
.cpub-cbedit-total { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-cbedit-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 8px; }
.cpub-cbedit-add:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-bg); }
.cpub-cbedit-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.cpub-cbedit-input { padding: 6px 8px; font-size: 12px; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text); outline: none; }
.cpub-cbedit-input:focus { border-color: var(--accent); }
.cpub-cbedit-input::placeholder { color: var(--text-faint); }
.cpub-cbedit-heading { width: 100%; font-weight: 600; }
.cpub-cbedit-preview { padding: 6px 0 2px; }
.cpub-cbedit-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cpub-cbedit-label { flex: 1; min-width: 140px; }
.cpub-cbedit-weight { width: 70px; }
.cpub-cbedit-colors { display: inline-flex; gap: 3px; }
.cpub-cbedit-swatch { width: 18px; height: 18px; border: var(--border-width-default) solid var(--border2); cursor: pointer; padding: 0; }
.cpub-cbedit-swatch-on { outline: 2px solid var(--text); outline-offset: 1px; }
.cpub-cbedit-remove { background: none; border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; padding: 4px 8px; }
.cpub-cbedit-remove:hover { border-color: var(--red-border); color: var(--red-text); }
.cpub-cbedit-empty { padding: 16px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; border: var(--border-width-default) dashed var(--border2); }
.cpub-cbedit-empty:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.cpub-cbedit-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
</style>
