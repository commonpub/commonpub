<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

defineOptions({ name: 'CpubMenu' });

const open = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function handleClickOutside(event: MouseEvent): void {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    close();
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (!open.value) return;

  if (event.key === 'Escape') {
    close();
    return;
  }

  if (!menuRef.value) return;

  const items = Array.from(
    menuRef.value.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')
  ) as HTMLElement[];

  const currentIndex = items.indexOf(document.activeElement as HTMLElement);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    items[next]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    items[prev]?.focus();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="wrapperRef" class="cpub-menu-wrapper" @keydown="handleKeydown">
    <div
      class="cpub-menu-trigger"
      @click="toggle"
      @keydown.enter="toggle"
      @keydown.space.prevent="toggle"
    >
      <slot name="trigger" />
    </div>
    <div
      v-if="open"
      ref="menuRef"
      class="cpub-menu"
      role="menu"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cpub-menu-wrapper {
  position: relative;
  display: inline-flex;
}

.cpub-menu-trigger {
  display: inline-flex;
}

.cpub-menu {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: var(--z-dropdown);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  min-width: 10rem;
  padding: var(--space-1) 0;
}
</style>
