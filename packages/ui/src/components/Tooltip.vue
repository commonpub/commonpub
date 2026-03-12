<script setup lang="ts">
import { ref } from 'vue';

defineOptions({ name: 'CpubTooltip' });

interface Props {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
});

const visible = ref(false);
let showTimeout: ReturnType<typeof setTimeout> | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

function show(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
  showTimeout = setTimeout(() => {
    visible.value = true;
  }, 300);
}

function hide(): void {
  if (showTimeout) {
    clearTimeout(showTimeout);
    showTimeout = null;
  }
  hideTimeout = setTimeout(() => {
    visible.value = false;
  }, 100);
}
</script>

<template>
  <span
    class="cpub-tooltip-wrapper"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
    <span
      v-if="visible"
      class="cpub-tooltip"
      :class="`cpub-tooltip--${props.position}`"
      role="tooltip"
    >
      {{ props.content }}
    </span>
  </span>
</template>

<style scoped>
.cpub-tooltip-wrapper {
  position: relative;
  display: inline-flex;
}

.cpub-tooltip {
  position: absolute;
  z-index: var(--z-tooltip);
  background-color: var(--text);
  color: var(--color-text-inverse);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius);
  white-space: nowrap;
  pointer-events: none;
  line-height: var(--leading-snug);
}

.cpub-tooltip--top {
  bottom: calc(100% + var(--space-2));
  left: 50%;
  transform: translateX(-50%);
}

.cpub-tooltip--bottom {
  top: calc(100% + var(--space-2));
  left: 50%;
  transform: translateX(-50%);
}

.cpub-tooltip--left {
  right: calc(100% + var(--space-2));
  top: 50%;
  transform: translateY(-50%);
}

.cpub-tooltip--right {
  left: calc(100% + var(--space-2));
  top: 50%;
  transform: translateY(-50%);
}
</style>
