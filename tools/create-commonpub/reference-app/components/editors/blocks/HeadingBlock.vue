<script setup lang="ts">
/**
 * Heading block — editable heading with level selector.
 */
const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const level = computed(() => (props.content.level as number) ?? 2);
const text = computed(() => (props.content.text as string) ?? '');
const headingEl = ref<HTMLElement | null>(null);

function onTextInput(event: Event): void {
  const el = event.target as HTMLElement;
  emit('update', { text: el.textContent ?? '', level: level.value });
}

function cycleLevel(): void {
  const next = level.value >= 4 ? 2 : level.value + 1;
  emit('update', { text: text.value, level: next });
}

// Set initial text without v-text (which fights with contenteditable)
onMounted(() => {
  if (headingEl.value && text.value) {
    headingEl.value.textContent = text.value;
  }
});
</script>

<template>
  <div class="cpub-heading-block">
    <button class="cpub-heading-level" title="Change heading level" aria-label="Change heading level" @click="cycleLevel">
      H{{ level }}
    </button>
    <div
      ref="headingEl"
      class="cpub-heading-text"
      :class="`cpub-heading-text--h${level}`"
      contenteditable="true"
      :data-placeholder="`Heading ${level}`"
      @input="onTextInput"
    />
  </div>
</template>

<style scoped>
.cpub-heading-block {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.cpub-heading-level {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-faint);
  background: var(--surface2);
  border: 2px solid var(--border2);
  padding: 2px 6px;
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 4px;
  transition: all 0.1s;
}

.cpub-heading-level:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.cpub-heading-text {
  flex: 1;
  font-weight: 700;
  outline: none;
  min-height: 1.2em;
  line-height: 1.3;
}

.cpub-heading-text:empty::before {
  content: attr(data-placeholder);
  color: var(--text-faint);
  pointer-events: none;
}

.cpub-heading-text--h1 { font-size: 28px; }
.cpub-heading-text--h2 { font-size: 22px; }
.cpub-heading-text--h3 { font-size: 18px; }
.cpub-heading-text--h4 { font-size: 15px; }
</style>
