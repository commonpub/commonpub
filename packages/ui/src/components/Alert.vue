<script setup lang="ts">
defineOptions({ name: 'CpubAlert' });

interface Props {
  variant?: 'info' | 'warning' | 'danger' | 'tip';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info',
});
</script>

<template>
  <div
    v-bind="$attrs"
    :class="['cpub-alert', `cpub-alert--${props.variant}`]"
    role="alert"
  >
    <slot />
  </div>
</template>

<style scoped>
.cpub-alert {
  padding: var(--space-4) var(--space-5);
  border-left: 4px solid var(--border);
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}

.cpub-alert--info {
  background-color: var(--accent-bg);
  border-left-color: var(--accent);
  color: var(--text);
}

.cpub-alert--warning {
  background-color: var(--yellow-bg);
  border-left-color: var(--yellow);
  color: var(--text);
}

.cpub-alert--danger {
  background-color: var(--red-bg);
  border-left-color: var(--red);
  color: var(--text);
}

.cpub-alert--tip {
  background-color: var(--green-bg);
  border-left-color: var(--green);
  color: var(--text);
}
</style>
