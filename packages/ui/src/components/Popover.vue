<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

defineOptions({ name: 'CpubPopover' });

interface Props {
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const props = withDefaults(defineProps<Props>(), {
  position: 'bottom',
});

const open = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);

function toggle(): void {
  open.value = !open.value;
}

function handleClickOutside(event: MouseEvent): void {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    open.value = false;
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div ref="wrapperRef" class="cpub-popover-wrapper">
    <div
      class="cpub-popover-trigger"
      role="button"
      tabindex="0"
      @click="toggle"
      @keydown.enter="toggle"
      @keydown.space.prevent="toggle"
    >
      <slot name="trigger" />
    </div>
    <div
      v-if="open"
      class="cpub-popover"
      :class="`cpub-popover--${props.position}`"
      role="dialog"
    >
      <slot name="content" />
    </div>
  </div>
</template>

<style scoped>
.cpub-popover-wrapper {
  position: relative;
  display: inline-flex;
}

.cpub-popover-trigger {
  display: inline-flex;
}

.cpub-popover {
  position: absolute;
  z-index: var(--z-dropdown);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: var(--space-3);
  min-width: 12rem;
}

.cpub-popover--bottom {
  top: calc(100% + var(--space-2));
  left: 0;
}

.cpub-popover--top {
  bottom: calc(100% + var(--space-2));
  left: 0;
}

.cpub-popover--left {
  right: calc(100% + var(--space-2));
  top: 0;
}

.cpub-popover--right {
  left: calc(100% + var(--space-2));
  top: 0;
}
</style>
