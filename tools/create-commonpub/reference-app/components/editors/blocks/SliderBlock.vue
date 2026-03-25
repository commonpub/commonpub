<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

interface FeedbackRange {
  min: number;
  max: number;
  state: string;
  message: string;
}

const label = computed(() => (props.content.label as string) ?? '');
const min = computed(() => (props.content.min as number) ?? 0);
const max = computed(() => (props.content.max as number) ?? 100);
const step = computed(() => (props.content.step as number) ?? 1);
const unit = computed(() => (props.content.unit as string) ?? '');
const defaultValue = computed(() => (props.content.defaultValue as number) ?? Math.round((min.value + max.value) / 2));
const feedback = computed<FeedbackRange[]>(() => {
  const raw = props.content.feedback;
  if (!Array.isArray(raw)) return [];
  return raw as FeedbackRange[];
});

function update(field: string, value: unknown): void {
  emit('update', { ...props.content, [field]: value });
}

function addFeedbackRange(): void {
  const ranges = [...feedback.value];
  // Default: fill the remaining range
  const lastMax = ranges.length > 0 ? ranges[ranges.length - 1]!.max + 1 : min.value;
  ranges.push({
    min: lastMax,
    max: max.value,
    state: 'ok',
    message: 'Describe what this range means...',
  });
  update('feedback', ranges);
}

function updateFeedbackRange(index: number, field: keyof FeedbackRange, value: string | number): void {
  const ranges = [...feedback.value];
  const range = { ...ranges[index]! };
  if (field === 'min' || field === 'max') {
    range[field] = Number(value);
  } else {
    range[field] = value as string;
  }
  ranges[index] = range;
  update('feedback', ranges);
}

function removeFeedbackRange(index: number): void {
  const ranges = feedback.value.filter((_: FeedbackRange, i: number) => i !== index);
  update('feedback', ranges);
}

const stateOptions = [
  { value: 'low', label: 'Low', color: 'var(--yellow)' },
  { value: 'slow', label: 'Slow', color: 'var(--yellow)' },
  { value: 'ok', label: 'OK', color: 'var(--green)' },
  { value: 'good', label: 'Good', color: 'var(--green)' },
  { value: 'high', label: 'High', color: 'var(--red)' },
  { value: 'danger', label: 'Danger', color: 'var(--red)' },
];

// Live preview value
const previewValue = ref(defaultValue.value);
const previewFillPct = computed(() => {
  if (max.value === min.value) return 0;
  return ((previewValue.value - min.value) / (max.value - min.value)) * 100;
});
const previewFeedback = computed(() => {
  return feedback.value.find(
    (r) => previewValue.value >= r.min && previewValue.value <= r.max,
  );
});
</script>

<template>
  <div class="cpub-slider-edit">
    <div class="cpub-slider-edit-header"><i class="fa-solid fa-sliders"></i> Interactive Slider</div>
    <div class="cpub-slider-edit-body">
      <label class="cpub-edit-label">Label</label>
      <input class="cpub-edit-input" :value="label" placeholder="e.g. Learning Rate" @input="update('label', ($event.target as HTMLInputElement).value)" />

      <div class="cpub-edit-row">
        <div class="cpub-edit-field">
          <label class="cpub-edit-label">Min</label>
          <input class="cpub-edit-input" type="number" :value="min" @input="update('min', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="cpub-edit-field">
          <label class="cpub-edit-label">Max</label>
          <input class="cpub-edit-input" type="number" :value="max" @input="update('max', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="cpub-edit-field">
          <label class="cpub-edit-label">Step</label>
          <input class="cpub-edit-input" type="number" :value="step" @input="update('step', Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div class="cpub-edit-field">
          <label class="cpub-edit-label">Unit</label>
          <input class="cpub-edit-input" :value="unit" placeholder="e.g. MHz" @input="update('unit', ($event.target as HTMLInputElement).value)" />
        </div>
      </div>

      <div class="cpub-edit-field">
        <label class="cpub-edit-label">Default Value</label>
        <input class="cpub-edit-input" type="number" :value="defaultValue" :min="min" :max="max" @input="update('defaultValue', Number(($event.target as HTMLInputElement).value))" />
      </div>

      <!-- Feedback Ranges -->
      <div class="cpub-feedback-section">
        <div class="cpub-feedback-header">
          <span class="cpub-edit-label" style="margin: 0">Feedback Ranges</span>
          <span class="cpub-feedback-hint">Define what different slider positions mean</span>
        </div>

        <div v-if="feedback.length === 0" class="cpub-feedback-empty">
          <i class="fa-solid fa-comment-dots"></i>
          <span>No feedback ranges configured. The slider will show a value but no contextual message.</span>
        </div>

        <div
          v-for="(range, i) in feedback"
          :key="i"
          class="cpub-feedback-range"
        >
          <div class="cpub-range-top-row">
            <div class="cpub-range-bounds">
              <input
                class="cpub-range-input"
                type="number"
                :value="range.min"
                title="Range min"
                @input="updateFeedbackRange(i, 'min', ($event.target as HTMLInputElement).value)"
              />
              <span class="cpub-range-dash">—</span>
              <input
                class="cpub-range-input"
                type="number"
                :value="range.max"
                title="Range max"
                @input="updateFeedbackRange(i, 'max', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <select
              class="cpub-range-state"
              :value="range.state"
              @change="updateFeedbackRange(i, 'state', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="opt in stateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <button class="cpub-range-remove" title="Remove range" @click="removeFeedbackRange(i)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <input
            class="cpub-edit-input cpub-range-message"
            :value="range.message"
            placeholder="What does this range mean? e.g. 'Too slow — model won't converge'"
            @input="updateFeedbackRange(i, 'message', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <button class="cpub-feedback-add" @click="addFeedbackRange">
          <i class="fa-solid fa-plus"></i> Add feedback range
        </button>
      </div>

      <!-- Live Preview -->
      <div class="cpub-slider-live-preview">
        <div class="cpub-preview-label">Live Preview</div>
        <div class="cpub-preview-value">{{ previewValue }}{{ unit }}</div>
        <div class="cpub-preview-track-wrap">
          <div class="cpub-preview-fill" :style="{ width: previewFillPct + '%' }"></div>
          <input
            v-model.number="previewValue"
            type="range"
            class="cpub-preview-range"
            :min="min"
            :max="max"
            :step="step"
          />
        </div>
        <div v-if="previewFeedback" class="cpub-preview-feedback" :class="`state-${previewFeedback.state}`">
          {{ previewFeedback.message }}
        </div>
        <div v-else class="cpub-preview-feedback cpub-preview-feedback--empty">
          No feedback for this value range
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-slider-edit { border: 2px solid var(--accent-border); background: var(--surface); }
.cpub-slider-edit-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--accent-bg); border-bottom: 2px solid var(--accent-border); display: flex; align-items: center; gap: 8px; color: var(--accent); }
.cpub-slider-edit-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.cpub-edit-label { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; display: block; }
.cpub-edit-input { width: 100%; font-size: 12px; background: var(--surface2); border: 1px solid var(--border2); padding: 6px 8px; color: var(--text); outline: none; }
.cpub-edit-input:focus { border-color: var(--accent); }
.cpub-edit-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
.cpub-edit-field { display: flex; flex-direction: column; }

/* Feedback Ranges */
.cpub-feedback-section { margin-top: 4px; border-top: 2px solid var(--border2); padding-top: 10px; }
.cpub-feedback-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
.cpub-feedback-hint { font-size: 10px; color: var(--text-dim); }

.cpub-feedback-empty {
  padding: 10px 12px;
  background: var(--surface2);
  border: 1px dashed var(--border2);
  font-size: 11px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.cpub-feedback-empty i { color: var(--text-faint); }

.cpub-feedback-range {
  background: var(--surface2);
  border: 1px solid var(--border2);
  padding: 8px;
  margin-bottom: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-range-top-row { display: flex; align-items: center; gap: 6px; }

.cpub-range-bounds { display: flex; align-items: center; gap: 4px; }
.cpub-range-input {
  width: 60px; font-size: 11px; font-family: var(--font-mono);
  background: var(--surface); border: 1px solid var(--border2);
  padding: 4px 6px; color: var(--text); outline: none; text-align: center;
}
.cpub-range-input:focus { border-color: var(--accent); }
.cpub-range-dash { font-size: 10px; color: var(--text-faint); }

.cpub-range-state {
  font-size: 11px; font-family: var(--font-mono);
  background: var(--surface); border: 1px solid var(--border2);
  padding: 4px 6px; color: var(--text); outline: none;
  min-width: 70px;
}

.cpub-range-remove {
  background: none; border: none; color: var(--text-faint);
  cursor: pointer; padding: 2px 4px; font-size: 10px; margin-left: auto;
}
.cpub-range-remove:hover { color: var(--red); }

.cpub-range-message { font-size: 11px; }

.cpub-feedback-add {
  width: 100%;
  font-size: 11px;
  color: var(--text-dim);
  background: none;
  border: 2px dashed var(--border2);
  padding: 6px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 4px;
}
.cpub-feedback-add:hover { border-color: var(--accent); color: var(--accent); }

/* Live Preview */
.cpub-slider-live-preview {
  margin-top: 4px;
  border-top: 2px solid var(--border2);
  padding-top: 10px;
}
.cpub-preview-label { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.cpub-preview-value { font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--accent); margin-bottom: 8px; }

.cpub-preview-track-wrap { position: relative; margin-bottom: 6px; }
.cpub-preview-fill {
  position: absolute; top: 50%; left: 0; height: 4px;
  background: var(--accent); transform: translateY(-50%);
  pointer-events: none; transition: width 0.05s;
}
.cpub-preview-range {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 4px; background: var(--surface3);
  border: 1px solid var(--border2); outline: none; cursor: pointer;
  position: relative; z-index: 1;
}
.cpub-preview-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; background: var(--accent);
  border: 2px solid var(--border); cursor: pointer;
}
.cpub-preview-range::-moz-range-thumb {
  width: 14px; height: 14px; background: var(--accent);
  border: 2px solid var(--border); cursor: pointer;
}

.cpub-preview-feedback {
  font-size: 11px; padding: 6px 10px; margin-top: 4px;
  display: flex; align-items: center; gap: 6px;
}
.cpub-preview-feedback.state-slow,
.cpub-preview-feedback.state-low { background: var(--yellow-bg); border: 1px solid var(--yellow-border); color: var(--yellow); }
.cpub-preview-feedback.state-ok,
.cpub-preview-feedback.state-good { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); }
.cpub-preview-feedback.state-high,
.cpub-preview-feedback.state-danger { background: var(--red-bg); border: 1px solid var(--red-border); color: var(--red); }
.cpub-preview-feedback--empty { background: var(--surface2); border: 1px dashed var(--border2); color: var(--text-faint); font-style: italic; }
</style>
