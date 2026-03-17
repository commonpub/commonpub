<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const label = computed(() => (props.content.label as string) ?? '');
const min = computed(() => (props.content.min as number) ?? 0);
const max = computed(() => (props.content.max as number) ?? 100);
const step = computed(() => (props.content.step as number) ?? 1);
const unit = computed(() => (props.content.unit as string) ?? '');

function update(field: string, value: unknown): void {
  emit('update', { ...props.content, [field]: value });
}
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

      <div class="cpub-slider-preview">
        <span class="cpub-slider-preview-text">Preview: {{ min }}{{ unit }} — {{ max }}{{ unit }}, step {{ step }}</span>
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
.cpub-slider-preview { padding: 8px; background: var(--surface2); border: 1px dashed var(--border2); font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }
</style>
