<script setup lang="ts">
/**
 * Callout block — variant picker (info/tip/warning/danger) + editable body.
 */
import { sanitizeBlockHtml } from '~/composables/useSanitize';

const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const html = computed(() => (props.content.html as string) ?? '');
const variant = computed(() => (props.content.variant as string) ?? 'info');

const variants = [
  { value: 'info', icon: 'fa-circle-info', label: 'Info', color: 'var(--accent)' },
  { value: 'tip', icon: 'fa-lightbulb', label: 'Tip', color: 'var(--green)' },
  { value: 'warning', icon: 'fa-triangle-exclamation', label: 'Warning', color: 'var(--yellow)' },
  { value: 'danger', icon: 'fa-circle-exclamation', label: 'Danger', color: 'var(--red)' },
] as const;

const currentVariant = computed(() => variants.find((v) => v.value === variant.value) ?? variants[0]);

function cycleVariant(): void {
  const idx = variants.findIndex((v) => v.value === variant.value);
  const next = variants[(idx + 1) % variants.length]!;
  emit('update', { html: html.value, variant: next.value });
}

function onBodyInput(event: Event): void {
  const el = event.target as HTMLElement;
  emit('update', { html: sanitizeBlockHtml(el.innerHTML), variant: variant.value });
}
</script>

<template>
  <div class="cpub-callout-block" :class="`cpub-callout--${variant}`">
    <button
      class="cpub-callout-icon-btn"
      :title="`${currentVariant.label} — click to change`"
      :style="{ color: currentVariant.color }"
      @click="cycleVariant"
    >
      <i :class="['fa-solid', currentVariant.icon]"></i>
    </button>
    <div class="cpub-callout-body">
      <div class="cpub-callout-label" :style="{ color: currentVariant.color }">{{ currentVariant.label }}</div>
      <div
        class="cpub-callout-text"
        contenteditable="true"
        data-placeholder="Callout text..."
        @input="onBodyInput"
        v-html="html"
      />
    </div>
  </div>
</template>

<style scoped>
.cpub-callout-block {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  border: 2px solid var(--border2);
  border-left-width: 5px;
}

.cpub-callout--info { border-left-color: var(--accent); background: var(--accent-bg); }
.cpub-callout--tip { border-left-color: var(--green); background: var(--green-bg); }
.cpub-callout--warning { border-left-color: var(--yellow); background: var(--yellow-bg); }
.cpub-callout--danger { border-left-color: var(--red); background: var(--red-bg); }

.cpub-callout-icon-btn {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform 0.15s;
}

.cpub-callout-icon-btn:hover {
  transform: scale(1.15);
}

.cpub-callout-body {
  flex: 1;
  min-width: 0;
}

.cpub-callout-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.cpub-callout-text {
  font-size: 13px;
  line-height: 1.65;
  color: var(--text);
  outline: none;
  min-height: 1.65em;
}

.cpub-callout-text:empty::before {
  content: attr(data-placeholder);
  color: var(--text-faint);
  pointer-events: none;
}
</style>
