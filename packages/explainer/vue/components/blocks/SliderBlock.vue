<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

const label = computed(() => (props.content.label as string) || 'Adjust Value');
const min = computed(() => (props.content.min as number) ?? 0);
const max = computed(() => (props.content.max as number) ?? 100);
const step = computed(() => (props.content.step as number) ?? 1);
const unit = computed(() => (props.content.unit as string) || '');
const defaultValue = computed(() => (props.content.defaultValue as number) ?? Math.round((min.value + max.value) / 2));

interface FeedbackRange {
  min: number;
  max: number;
  state: string;
  message: string;
}

const feedbackRanges = computed<FeedbackRange[]>(() => {
  const raw = props.content.feedback;
  if (!Array.isArray(raw)) return [];
  return raw as FeedbackRange[];
});

const value = ref(defaultValue.value);

const fillPct = computed(() => ((value.value - min.value) / (max.value - min.value)) * 100);

const currentFeedback = computed(() =>
  feedbackRanges.value.find((r) => value.value >= r.min && value.value <= r.max),
);

const feedbackState = computed(() => currentFeedback.value?.state || '');
</script>

<template>
  <div class="cpub-block-slider">
    <div class="cpub-card-header">
      <div class="cpub-card-header-icon">&#9776;</div>
      <div class="cpub-card-header-label">
        {{ label }}
        <span>Interactive</span>
      </div>
    </div>

    <div class="cpub-slider-value-display">{{ value }}{{ unit }}</div>

    <div class="cpub-slider-track-wrap">
      <div class="cpub-slider-fill-track" :style="{ width: fillPct + '%' }"></div>
      <input
        v-model.number="value"
        type="range"
        class="cpub-slider-input"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="label"
      />
    </div>

    <div class="cpub-slider-range-labels">
      <span>{{ min }}{{ unit }}</span>
      <span>{{ max }}{{ unit }}</span>
    </div>

    <div v-if="currentFeedback" class="cpub-slider-output" :class="`state-${feedbackState}`">
      <span class="cpub-slider-output-text">{{ currentFeedback.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-slider { background: var(--surface); border: var(--border-width-default) solid var(--border); border-left: 4px solid var(--accent); padding: 22px 24px; margin: 28px 0; box-shadow: var(--shadow-md); }
.cpub-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.cpub-card-header-icon { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); color: var(--accent); font-size: 13px; flex-shrink: 0; }
.cpub-card-header-label { font-size: 13px; font-weight: 700; color: var(--text); }
.cpub-card-header-label span { font-family: var(--font-mono); font-size: 12px; color: var(--text-dim); margin-left: 4px; }
.cpub-slider-value-display { font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--accent); margin-bottom: 14px; letter-spacing: 0.04em; }
.cpub-slider-track-wrap { position: relative; margin-bottom: 10px; }
.cpub-slider-fill-track { position: absolute; top: 50%; left: 0; height: 6px; background: var(--accent); transform: translateY(-50%); pointer-events: none; transition: width 0.05s; }
.cpub-slider-input { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; background: var(--surface3); border: var(--border-width-default) solid var(--border); outline: none; cursor: pointer; position: relative; z-index: 1; }
.cpub-slider-input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; background: var(--accent); border: var(--border-width-default) solid var(--border); cursor: pointer; box-shadow: var(--shadow-sm); }
.cpub-slider-input::-moz-range-thumb { width: 18px; height: 18px; background: var(--accent); border: var(--border-width-default) solid var(--border); cursor: pointer; box-shadow: var(--shadow-sm); }
.cpub-slider-range-labels { display: flex; justify-content: space-between; margin-top: 8px; }
.cpub-slider-range-labels span { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }
.cpub-slider-output { margin-top: 16px; padding: 12px 14px; font-size: 13px; display: flex; align-items: center; gap: 8px; transition: all 0.2s; min-height: 42px; }
.cpub-slider-output.state-slow, .cpub-slider-output.state-low { background: var(--yellow-bg); border: var(--border-width-default) solid var(--yellow-border); color: var(--yellow); }
.cpub-slider-output.state-ok, .cpub-slider-output.state-good { background: var(--green-bg); border: var(--border-width-default) solid var(--green-border); color: var(--green); }
.cpub-slider-output.state-high, .cpub-slider-output.state-danger { background: var(--red-bg); border: var(--border-width-default) solid var(--red-border); color: var(--red); }
.cpub-slider-output-text { line-height: 1.4; }
</style>
