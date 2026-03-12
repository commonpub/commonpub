<script setup lang="ts">
defineOptions({ name: 'CpubMenuItem', inheritAttrs: false });

interface Props {
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  select: [];
}>();

function handleClick(): void {
  if (!props.disabled) {
    emit('select');
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleClick();
  }
}
</script>

<template>
  <div
    v-bind="$attrs"
    :class="['cpub-menu-item', { 'cpub-menu-item--disabled': props.disabled }]"
    role="menuitem"
    :tabindex="props.disabled ? -1 : 0"
    :aria-disabled="props.disabled || undefined"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <slot />
  </div>
</template>

<style scoped>
.cpub-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  white-space: nowrap;
}

.cpub-menu-item:hover:not(.cpub-menu-item--disabled) {
  background-color: var(--surface2);
}

.cpub-menu-item:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-menu-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
