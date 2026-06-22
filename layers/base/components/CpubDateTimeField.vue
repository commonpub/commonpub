<script setup lang="ts">
/**
 * Themed datetime field — one offset-correct, theme-aware replacement for raw
 * `<input type="datetime-local">` across the contest editor (and reusable
 * elsewhere). The model value is an ISO instant; the control speaks the viewer's
 * local wall-clock via the shared utils/datetime helpers (no UTC shift, the bug
 * fixed in Phase 1). `min`/`max` accept ISO and constrain the native picker (e.g.
 * a stage's end can't precede its start). The native popup themes correctly via
 * `color-scheme` on :root (packages/ui/theme/base.css).
 */
const props = defineProps<{
  modelValue?: string | null;
  label?: string;
  min?: string | null;
  max?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** Explicit id for the input; otherwise an SSR-safe one is generated. */
  id?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>();

const generatedId = useId();
const fieldId = computed(() => props.id ?? `cpub-dt-${generatedId}`);

const localValue = computed(() => toLocalInput(props.modelValue));
const localMin = computed(() => toLocalInput(props.min) || undefined);
const localMax = computed(() => toLocalInput(props.max) || undefined);

function onInput(e: Event): void {
  emit('update:modelValue', fromLocalInput((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="cpub-datetime-field">
    <label v-if="label" :for="fieldId" class="cpub-form-label">
      {{ label }}<span v-if="required" class="cpub-datetime-req" aria-hidden="true"> *</span>
    </label>
    <input
      :id="fieldId"
      type="datetime-local"
      class="cpub-input"
      :value="localValue"
      :min="localMin"
      :max="localMax"
      :required="required"
      :disabled="disabled"
      :aria-label="label ? undefined : 'Date and time'"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.cpub-datetime-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.cpub-datetime-req {
  color: var(--red);
}
</style>
