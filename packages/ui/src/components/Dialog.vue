<script setup lang="ts">
import { watch, ref, nextTick, onUnmounted } from 'vue';

defineOptions({ name: 'CpubDialog', inheritAttrs: false });

interface Props {
  open: boolean;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const previousActiveElement = ref<HTMLElement | null>(null);

function close(): void {
  emit('update:open', false);
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    close();
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
    return;
  }

  // Focus trap
  if (event.key === 'Tab' && dialogRef.value) {
    const focusable = dialogRef.value.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    previousActiveElement.value = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    await nextTick();
    const focusable = dialogRef.value?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement | null;
    focusable?.focus();
  } else {
    document.body.style.overflow = '';
    previousActiveElement.value?.focus();
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.open"
      class="cpub-dialog-backdrop"
      @click="handleBackdropClick"
      @keydown="handleKeydown"
    >
      <div
        ref="dialogRef"
        v-bind="$attrs"
        class="cpub-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="props.title"
      >
        <div v-if="props.title" class="cpub-dialog__header">
          <h2 class="cpub-dialog__title">{{ props.title }}</h2>
          <button
            class="cpub-dialog__close"
            aria-label="Close dialog"
            @click="close"
          >
            &#10005;
          </button>
        </div>
        <div class="cpub-dialog__body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop);
  background-color: var(--color-surface-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.cpub-dialog {
  z-index: var(--z-modal);
  background-color: var(--surface);
  border: var(--border-width-default) solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  max-width: 32rem;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.cpub-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: var(--border-width-thin) solid var(--border2);
}

.cpub-dialog__title {
  font-family: var(--font-heading);
  font-size: var(--text-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  margin: 0;
  line-height: var(--leading-tight);
}

.cpub-dialog__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim);
  font-size: var(--text-base);
  border-radius: var(--radius);
  transition: color var(--transition-fast);
  padding: 0;
}

.cpub-dialog__close:hover {
  color: var(--text);
}

.cpub-dialog__close:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-dialog__body {
  padding: var(--space-6);
}
</style>
