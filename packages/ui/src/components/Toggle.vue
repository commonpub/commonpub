<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'CpubToggle' });

interface Props {
  modelValue?: boolean;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  label: undefined,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const toggleId = computed(() => `cpub-toggle-${Math.random().toString(36).slice(2, 9)}`);

function toggle(): void {
  emit('update:modelValue', !props.modelValue);
}
</script>

<template>
  <div class="cpub-toggle-group">
    <button
      :id="toggleId"
      type="button"
      role="switch"
      :aria-checked="props.modelValue"
      :aria-label="props.label || undefined"
      :class="['cpub-toggle', { 'cpub-toggle--on': props.modelValue }]"
      @click="toggle"
    >
      <span class="cpub-toggle__thumb" />
    </button>
    <label
      v-if="props.label"
      :for="toggleId"
      class="cpub-toggle-group__label"
      @click="toggle"
    >
      {{ props.label }}
    </label>
  </div>
</template>

<style scoped>
.cpub-toggle-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.cpub-toggle-group__label {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text);
  cursor: pointer;
  user-select: none;
}

.cpub-toggle {
  position: relative;
  width: 2.75rem;
  height: 1.5rem;
  background-color: var(--surface3);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  padding: 0;
  flex-shrink: 0;
}

.cpub-toggle--on {
  background-color: var(--accent);
}

.cpub-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1rem;
  height: 1rem;
  background-color: var(--surface);
  border: var(--border-width-thin) solid var(--border);
  border-radius: var(--radius-full);
  transition: transform var(--transition-fast);
}

.cpub-toggle--on .cpub-toggle__thumb {
  transform: translateX(1.25rem);
}

.cpub-toggle:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent);
}
</style>
