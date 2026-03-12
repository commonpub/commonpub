<script setup lang="ts">
import { computed, useAttrs } from 'vue';

defineOptions({ name: 'CpubInput', inheritAttrs: false });

interface Props {
  label?: string;
  error?: string;
  hint?: string;
  modelValue?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  error: undefined,
  hint: undefined,
  modelValue: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const attrs = useAttrs();

const inputId = computed(() => (attrs.id as string) || `cpub-input-${Math.random().toString(36).slice(2, 9)}`);
const errorId = computed(() => props.error ? `${inputId.value}-error` : undefined);
const hintId = computed(() => props.hint ? `${inputId.value}-hint` : undefined);

const describedBy = computed(() => {
  const ids: string[] = [];
  if (errorId.value) ids.push(errorId.value);
  if (hintId.value) ids.push(hintId.value);
  return ids.length ? ids.join(' ') : undefined;
});

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div :class="['cpub-input-group', { 'cpub-input-group--error': props.error }]">
    <label
      v-if="props.label"
      :for="inputId"
      class="cpub-input-group__label"
    >
      {{ props.label }}
    </label>
    <input
      v-bind="attrs"
      :id="inputId"
      class="cpub-input"
      :value="props.modelValue"
      :aria-invalid="props.error ? true : undefined"
      :aria-describedby="describedBy"
      @input="onInput"
    />
    <p v-if="props.error" :id="errorId" class="cpub-input-group__error" role="alert">
      {{ props.error }}
    </p>
    <p v-if="props.hint && !props.error" :id="hintId" class="cpub-input-group__hint">
      {{ props.hint }}
    </p>
  </div>
</template>

<style scoped>
.cpub-input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cpub-input-group__label {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--text);
  font-weight: var(--font-weight-medium);
}

.cpub-input {
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-2) var(--space-3);
  transition: box-shadow var(--transition-fast);
  width: 100%;
}

.cpub-input::placeholder {
  color: var(--text-faint);
}

.cpub-input:focus {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-input-group--error .cpub-input {
  border-color: var(--red);
}

.cpub-input-group--error .cpub-input:focus {
  box-shadow: 4px 4px 0 var(--red);
}

.cpub-input-group__error {
  font-size: var(--text-sm);
  color: var(--red);
  margin: 0;
}

.cpub-input-group__hint {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: 0;
}
</style>
