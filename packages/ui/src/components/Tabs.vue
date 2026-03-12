<script setup lang="ts">
defineOptions({ name: 'CpubTabs' });

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  modelValue: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function selectTab(id: string): void {
  emit('update:modelValue', id);
}

function handleKeydown(event: KeyboardEvent, index: number): void {
  let newIndex = index;

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    newIndex = index < props.tabs.length - 1 ? index + 1 : 0;
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    newIndex = index > 0 ? index - 1 : props.tabs.length - 1;
  } else if (event.key === 'Home') {
    event.preventDefault();
    newIndex = 0;
  } else if (event.key === 'End') {
    event.preventDefault();
    newIndex = props.tabs.length - 1;
  } else {
    return;
  }

  const tab = props.tabs[newIndex]!;
  selectTab(tab.id);

  const tabEl = (event.currentTarget as HTMLElement)
    .parentElement
    ?.querySelectorAll('[role="tab"]')[newIndex] as HTMLElement | undefined;
  tabEl?.focus();
}
</script>

<template>
  <div class="cpub-tabs">
    <div class="cpub-tabs__list" role="tablist">
      <button
        v-for="(tab, index) in props.tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="props.modelValue === tab.id"
        :tabindex="props.modelValue === tab.id ? 0 : -1"
        :class="['cpub-tabs__tab', { 'cpub-tabs__tab--active': props.modelValue === tab.id }]"
        @click="selectTab(tab.id)"
        @keydown="handleKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="cpub-tabs__panel" role="tabpanel">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cpub-tabs__list {
  display: flex;
  border-bottom: var(--border-width-default) solid var(--border2);
  gap: 0;
}

.cpub-tabs__tab {
  font-family: var(--font-mono);
  font-size: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--text-dim);
  background: none;
  border: none;
  border-bottom: var(--border-width-default) solid transparent;
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
  margin-bottom: calc(-1 * var(--border-width-default));
  font-weight: var(--font-weight-medium);
}

.cpub-tabs__tab:hover {
  color: var(--text);
}

.cpub-tabs__tab--active {
  color: var(--text);
  border-bottom-color: var(--accent);
}

.cpub-tabs__tab:focus-visible {
  outline: none;
  box-shadow: var(--shadow-accent);
}

.cpub-tabs__panel {
  padding: var(--space-4) 0;
}
</style>
