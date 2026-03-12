<script setup lang="ts">
import { computed, useAttrs } from 'vue';

defineOptions({ name: 'CpubTextarea', inheritAttrs: false });

interface Props {
  label?: string;
  error?: string;
  hint?: string;
  modelValue?: string;
  rows?: number;
}

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  error: undefined,
  hint: undefined,
  modelValue: '',
  rows: 4,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const attrs = useAttrs();

const textareaId = computed(() => (attrs.id as string) || `cpub-textarea-${Math.random().toString(36).slice(2, 9)}`);
const errorId = computed(() => props.error ? `${textareaId.value}-error` : undefined);
const hintId = computed(() => props.hint ? `${textareaId.value}-hint` : undefined);

const describedBy = computed(() => {
  const ids: string[] = [];
  if (errorId.value) ids.push(errorId.value);
  if (hintId.value) ids.push(hintId.value);
  return ids.length ? ids.join(' ') : undefined;
});

function onInput(event: Event): void {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <div :class="['cpub-textarea-group', { 'cpub-textarea-group--error': props.error }]">
    <label
      v-if="props.label"
      :for="textareaId"
      class="cpub-textarea-group__label"
    >
      {{ props.label }}
    </label>
    <textarea
      v-bind="attrs"
      :id="textareaId"
      class="cpub-textarea"
      :value="props.modelValue"
      :rows="props.rows"
      :aria-invalid="props.error ? true : undefined"
      :aria-describedby="describedBy"
      @input="onInput"
    />
    <p v-if="props.error" :id="errorId" class="cpub-textarea-group__error" role="alert">
      {{ props.error }}
    </p>
    <p v-if="props.hint && !props.error" :id="hintId" class="cpub-textarea-group__hint">
      {{ props.hint }}
    </p>
  </div>
</template>

<style scoped>
.cpub-textarea-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.cpub-textarea-group__label {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--text);
  font-weight: var(--font-weight-medium);
}

.cpub-textarea {
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--text);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  padding: var(--space-2) var(--space-3);
  transition: box-shadow var(--transition-fast);
  width: 100%;
  resize: vertical;
}

.cpub-textarea::placeholder {
  color: var(--text-faint);
}

.cpub-textarea:focus {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-textarea-group--error .cpub-textarea {
  border-color: var(--red);
}

.cpub-textarea-group--error .cpub-textarea:focus {
  box-shadow: 4px 4px 0 var(--red);
}

.cpub-textarea-group__error {
  font-size: var(--text-sm);
  color: var(--red);
  margin: 0;
}

.cpub-textarea-group__hint {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: 0;
}
</style>
