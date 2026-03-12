<script setup lang="ts">
defineOptions({ name: 'CpubIconButton', inheritAttrs: false });

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
});
</script>

<template>
  <button
    v-bind="$attrs"
    :class="[
      'cpub-icon-btn',
      `cpub-icon-btn--${props.variant}`,
      `cpub-icon-btn--${props.size}`,
    ]"
    :aria-label="props.label"
  >
    <slot />
  </button>
</template>

<style scoped>
.cpub-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  box-shadow: var(--shadow-md);
  padding: 0;
}

.cpub-icon-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-lg);
}

.cpub-icon-btn:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: var(--shadow-sm);
}

.cpub-icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Sizes */
.cpub-icon-btn--sm {
  width: 2rem;
  height: 2rem;
  font-size: var(--text-sm);
}

.cpub-icon-btn--md {
  width: 2.5rem;
  height: 2.5rem;
  font-size: var(--text-base);
}

.cpub-icon-btn--lg {
  width: 3rem;
  height: 3rem;
  font-size: var(--text-md);
}

/* Variants */
.cpub-icon-btn--primary {
  background-color: var(--accent);
  color: var(--color-on-accent);
}

.cpub-icon-btn--secondary {
  background-color: var(--surface);
  color: var(--text);
}

.cpub-icon-btn--ghost {
  background-color: transparent;
  color: var(--text);
  border-color: transparent;
  box-shadow: none;
}

.cpub-icon-btn--ghost:hover:not(:disabled) {
  background-color: var(--surface2);
  box-shadow: none;
  transform: none;
}
</style>
