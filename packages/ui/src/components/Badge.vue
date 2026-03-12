<script setup lang="ts">
defineOptions({ name: 'CpubBadge', inheritAttrs: false });

interface Props {
  variant?: 'default' | 'accent' | 'green' | 'red' | 'yellow' | 'purple' | 'teal' | 'pink' | 'outline';
  size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'sm',
});
</script>

<template>
  <span
    v-bind="$attrs"
    :class="[
      'cpub-badge',
      `cpub-badge--${props.variant}`,
      `cpub-badge--${props.size}`,
    ]"
  >
    <slot />
  </span>
</template>

<style scoped>
.cpub-badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius);
  white-space: nowrap;
  line-height: 1;
}

/* Sizes */
.cpub-badge--sm {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-2);
}

.cpub-badge--md {
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
}

/* Variants */
.cpub-badge--default {
  background-color: var(--surface3);
  color: var(--text);
}

.cpub-badge--accent {
  background-color: var(--accent-bg);
  color: var(--accent);
}

.cpub-badge--green {
  background-color: var(--green-bg);
  color: var(--green);
}

.cpub-badge--red {
  background-color: var(--red-bg);
  color: var(--red);
}

.cpub-badge--yellow {
  background-color: var(--yellow-bg);
  color: var(--yellow);
}

.cpub-badge--purple {
  background-color: var(--purple-bg);
  color: var(--purple);
}

.cpub-badge--teal {
  background-color: var(--teal-bg);
  color: var(--teal);
}

.cpub-badge--pink {
  background-color: var(--pink-bg);
  color: var(--pink);
}

.cpub-badge--outline {
  background-color: transparent;
  color: var(--text);
  border: var(--border-width-thin) solid var(--border2);
}
</style>
