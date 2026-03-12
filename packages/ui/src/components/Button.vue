<script setup lang="ts">
defineOptions({ name: 'CpubButton', inheritAttrs: false });

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
});
</script>

<template>
  <button
    v-bind="$attrs"
    :class="[
      'cpub-btn',
      `cpub-btn--${props.variant}`,
      `cpub-btn--${props.size}`,
      { 'cpub-btn--loading': props.loading },
    ]"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
  >
    <span v-if="props.loading" class="cpub-btn__spinner" aria-hidden="true" />
    <span :class="{ 'cpub-btn__content--hidden': props.loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.cpub-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-body);
  font-weight: var(--font-weight-semibold);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  position: relative;
  box-shadow: var(--shadow-md);
  line-height: var(--leading-tight);
  white-space: nowrap;
}

.cpub-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-lg);
}

.cpub-btn:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: var(--shadow-sm);
}

.cpub-btn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

/* Sizes */
.cpub-btn--sm {
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  min-height: 2rem;
}

.cpub-btn--md {
  font-size: var(--text-base);
  padding: var(--space-2) var(--space-4);
  min-height: 2.5rem;
}

.cpub-btn--lg {
  font-size: var(--text-md);
  padding: var(--space-3) var(--space-6);
  min-height: 3rem;
}

/* Variants */
.cpub-btn--primary {
  background-color: var(--accent);
  color: var(--color-on-accent);
  border-color: var(--border);
}

.cpub-btn--secondary {
  background-color: var(--surface);
  color: var(--text);
  border-color: var(--border);
}

.cpub-btn--ghost {
  background-color: transparent;
  color: var(--text);
  border-color: transparent;
  box-shadow: none;
}

.cpub-btn--ghost:hover:not(:disabled) {
  background-color: var(--surface2);
  box-shadow: none;
  transform: none;
}

.cpub-btn--danger {
  background-color: var(--red);
  color: var(--color-text-inverse);
  border-color: var(--border);
}

/* Spinner */
.cpub-btn__spinner {
  position: absolute;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: var(--radius-full);
  animation: cpub-spin 0.6s linear infinite;
}

.cpub-btn__content--hidden {
  visibility: hidden;
}

@keyframes cpub-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
