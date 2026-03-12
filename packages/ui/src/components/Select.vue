<script setup lang="ts">
import { computed, useAttrs } from 'vue';

defineOptions({ name: 'CpubSelect', inheritAttrs: false });

interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  error?: string;
  options: SelectOption[];
  modelValue?: string;
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  error: undefined,
  modelValue: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const attrs = useAttrs();

const selectId = computed(() => (attrs.id as string) || `cpub-select-${Math.random().toString(36).slice(2, 9)}`);
const errorId = computed(() => props.error ? `${selectId.value}-error` : undefined);

function onChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div :class="['cpub-select-group', { 'cpub-select-group--error': props.error }]">
    <label
      v-if="props.label"
      :for="selectId"
      class="cpub-select-group__label"
    >
      {{ props.label }}
    </label>
    <div class="cpub-select-wrapper">
      <select
        v-bind="attrs"
        :id="selectId"
        class="cpub-select"
        :value="props.modelValue"
        :aria-invalid="props.error ? true : undefined"
        :aria-describedby="errorId"
        @change="onChange"
      >
        <option
          v-for="opt in props.options"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
      <span class="cpub-select-wrapper__arrow" aria-hidden="true">&#9660;</span>
    </div>
    <p v-if="props.error" :id="errorId" class="cpub-select-group__error" role="alert">
      {{ props.error }}
    </p>
  </div>
</template>

<style scoped>
.cpub-select-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cpub-select-group__label {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--text);
  font-weight: var(--font-weight-medium);
}

.cpub-select-wrapper {
  position: relative;
  display: flex;
}

.cpub-select {
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-2) var(--space-8) var(--space-2) var(--space-3);
  transition: box-shadow var(--transition-fast);
  width: 100%;
  appearance: none;
  cursor: pointer;
}

.cpub-select:focus {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-select-wrapper__arrow {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--text-xs);
  color: var(--text-dim);
  pointer-events: none;
}

.cpub-select-group--error .cpub-select {
  border-color: var(--red);
}

.cpub-select-group__error {
  font-size: var(--text-sm);
  color: var(--red);
  margin: 0;
}
</style>
