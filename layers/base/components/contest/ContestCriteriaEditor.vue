<script setup lang="ts">
/**
 * Reusable judging-rubric editor — ONE component for both the contest-level
 * criteria (Judging tab) and a review stage's per-round criteria. v-model an array
 * of `{ label, weight?, description? }`; weight is clamped 0–100 and omitted (not
 * null) when blank, matching `contestJudgingCriterionSchema`. Pure presentational
 * + immutable emits — no side effects, so it's trivially testable + drop-in
 * wherever a rubric is edited (kills the prior duplicate editors).
 */
export interface ContestCriterion {
  label: string;
  weight?: number;
  description?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: ContestCriterion[] | null;
    /** Header label (e.g. "Judging criteria"). */
    label?: string;
    /** Show the summed points badge in the header. */
    showTotal?: boolean;
  }>(),
  { modelValue: () => [], label: 'Judging criteria', showTotal: true },
);

const emit = defineEmits<{ 'update:modelValue': [value: ContestCriterion[]] }>();

const items = computed<ContestCriterion[]>(() => props.modelValue ?? []);
const total = computed(() => items.value.reduce((s, c) => s + (c.weight ?? 0), 0));

function set(i: number, patch: Partial<ContestCriterion>): void {
  emit('update:modelValue', items.value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
}
function setWeight(i: number, raw: string): void {
  const n = raw === '' ? undefined : Math.max(0, Math.min(100, Math.round(Number(raw))));
  set(i, { weight: Number.isFinite(n as number) ? n : undefined });
}
function add(): void {
  emit('update:modelValue', [...items.value, { label: '' }]);
}
function remove(i: number): void {
  emit('update:modelValue', items.value.filter((_, idx) => idx !== i));
}
</script>

<template>
  <div class="cpub-criteria-editor">
    <div class="cpub-criteria-head">
      <span class="cpub-criteria-title">
        {{ label }}<span v-if="showTotal && total" class="cpub-criteria-total">{{ total }} pts</span>
      </span>
      <button type="button" class="cpub-btn cpub-btn-sm" @click="add"><i class="fa-solid fa-plus"></i> Add</button>
    </div>
    <p v-if="!items.length" class="cpub-criteria-empty">No rubric yet. Judges score an overall 1–100 unless you add criteria.</p>
    <div v-for="(c, i) in items" :key="i" class="cpub-criteria-row">
      <div class="cpub-criteria-main">
        <input :value="c.label" type="text" class="cpub-input" :aria-label="`Criterion ${i + 1} label`" placeholder="e.g. Technical merit" @input="set(i, { label: ($event.target as HTMLInputElement).value })" />
        <input :value="c.weight ?? ''" type="number" min="0" max="100" class="cpub-input cpub-criteria-pts" :aria-label="`Criterion ${i + 1} points`" placeholder="pts" @input="setWeight(i, ($event.target as HTMLInputElement).value)" />
        <button type="button" class="cpub-criteria-del" :aria-label="`Remove criterion ${i + 1}`" @click="remove(i)"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <input :value="c.description ?? ''" type="text" class="cpub-input cpub-criteria-desc" :aria-label="`Criterion ${i + 1} description`" placeholder="What judges look for (optional)" @input="set(i, { description: ($event.target as HTMLInputElement).value || undefined })" />
    </div>
  </div>
</template>

<style scoped>
.cpub-criteria-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: var(--space-2); }
.cpub-criteria-title { font-size: var(--text-xs); font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); display: inline-flex; align-items: center; gap: 8px; }
.cpub-criteria-total { color: var(--accent); }
.cpub-criteria-empty { font-size: var(--text-sm); color: var(--text-faint); margin: 0 0 var(--space-2); }
.cpub-criteria-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-2); }
.cpub-criteria-main { display: flex; align-items: center; gap: 6px; }
.cpub-criteria-main .cpub-input { flex: 1; }
.cpub-criteria-pts { max-width: 80px; flex: none !important; text-align: center; }
.cpub-criteria-del { background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text-faint); cursor: pointer; font-size: 11px; padding: 0 9px; flex-shrink: 0; }
.cpub-criteria-del:hover { border-color: var(--red-border); color: var(--red-text); }
.cpub-criteria-desc { font-size: var(--text-xs); }
</style>
