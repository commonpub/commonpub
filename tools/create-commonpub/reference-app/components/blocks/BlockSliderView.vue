<script setup lang="ts">
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

const fillPct = computed(() => {
  return ((value.value - min.value) / (max.value - min.value)) * 100;
});

const currentFeedback = computed(() => {
  return feedbackRanges.value.find(
    (r) => value.value >= r.min && value.value <= r.max,
  );
});

const feedbackState = computed(() => currentFeedback.value?.state || '');

const stateIcons: Record<string, string> = {
  slow: 'fa-solid fa-gauge-simple',
  ok: 'fa-solid fa-circle-check',
  high: 'fa-solid fa-triangle-exclamation',
  low: 'fa-solid fa-gauge-simple',
  good: 'fa-solid fa-circle-check',
  danger: 'fa-solid fa-triangle-exclamation',
};
</script>

<template>
  <div class="cpub-block-slider">
    <div class="cpub-card-header">
      <div class="cpub-card-header-icon"><i class="fa-solid fa-sliders"></i></div>
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

    <div
      v-if="currentFeedback"
      class="cpub-slider-output"
      :class="`state-${feedbackState}`"
    >
      <i :class="stateIcons[feedbackState] || 'fa-solid fa-circle-info'"></i>
      <span class="cpub-slider-output-text">{{ currentFeedback.message }}</span>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-slider {
  background: var(--surface);
  border: 2px solid var(--border);
  border-left: 4px solid var(--accent);
  padding: 22px 24px;
  margin: 28px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.cpub-card-header-icon {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  border: 2px solid var(--accent-border);
  color: var(--accent);
  font-size: 13px;
  flex-shrink: 0;
}

.cpub-card-header-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.cpub-card-header-label span {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  margin-left: 4px;
}

.cpub-slider-value-display {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 14px;
  letter-spacing: 0.04em;
}

.cpub-slider-track-wrap {
  position: relative;
  margin-bottom: 10px;
}

.cpub-slider-fill-track {
  position: absolute;
  top: 50%;
  left: 0;
  height: 6px;
  background: var(--accent);
  transform: translateY(-50%);
  pointer-events: none;
  transition: width 0.05s;
}

.cpub-slider-input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: var(--surface3);
  border: 2px solid var(--border);
  outline: none;
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.cpub-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--accent);
  border: 2px solid var(--border);
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-slider-input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--accent);
  border: 2px solid var(--border);
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--border);
}

.cpub-slider-range-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

.cpub-slider-range-labels span {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
}

.cpub-slider-output {
  margin-top: 16px;
  padding: 12px 14px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  min-height: 42px;
}

.cpub-slider-output.state-slow,
.cpub-slider-output.state-low {
  background: var(--yellow-bg);
  border: 2px solid var(--yellow-border);
  color: var(--yellow);
}

.cpub-slider-output.state-ok,
.cpub-slider-output.state-good {
  background: var(--green-bg);
  border: 2px solid var(--green-border);
  color: var(--green);
}

.cpub-slider-output.state-high,
.cpub-slider-output.state-danger {
  background: var(--red-bg);
  border: 2px solid var(--red-border);
  color: var(--red);
}

.cpub-slider-output i { font-size: 13px; flex-shrink: 0; }
.cpub-slider-output-text { line-height: 1.4; }
</style>
