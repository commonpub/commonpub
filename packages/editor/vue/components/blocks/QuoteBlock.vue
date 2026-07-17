<script setup lang="ts">
/**
 * Blockquote block — styled quote with editable body and attribution.
 */
import { computed, ref, onMounted, watch } from 'vue';
import { sanitizeBlockHtml } from '../../utils.js';

const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const html = computed(() => (props.content.html as string) ?? '');
const attribution = computed(() => (props.content.attribution as string) ?? '');

const bodyEl = ref<HTMLElement | null>(null);

// Uncontrolled contenteditable: seed once, write back only on genuine external
// changes. Binding with `v-html` would re-assign `innerHTML` on every keystroke
// (the value echoes back via the parent), collapsing the caret to offset 0 and
// reversing typed input. Guarding the write keeps the caret stable.
// Sanitize on READ too (see CalloutBlock): an externally-sourced body (markdown
// import from the allowDangerousHtml parser) could carry an event-handler payload
// that fires in the editor session when the block opens.
onMounted(() => {
  if (bodyEl.value) bodyEl.value.innerHTML = sanitizeBlockHtml(html.value);
});

watch(html, (newHtml: string): void => {
  const el = bodyEl.value;
  const safe = sanitizeBlockHtml(newHtml);
  if (el && safe !== el.innerHTML) {
    el.innerHTML = safe;
  }
});

function onBodyInput(event: Event): void {
  const el = event.target as HTMLElement;
  emit('update', { html: sanitizeBlockHtml(el.innerHTML), attribution: attribution.value });
}

function onAttributionInput(event: Event): void {
  emit('update', { html: html.value, attribution: (event.target as HTMLInputElement).value });
}
</script>

<template>
  <div class="cpub-quote-block">
    <div class="cpub-quote-bar" aria-hidden="true" />
    <div class="cpub-quote-body">
      <div
        ref="bodyEl"
        class="cpub-quote-text"
        contenteditable="true"
        data-placeholder="Enter quote..."
        @input="onBodyInput"
      />
      <input
        class="cpub-quote-attribution"
        type="text"
        :value="attribution"
        placeholder="— Source or author"
        aria-label="Quote attribution"
        @input="onAttributionInput"
      />
    </div>
  </div>
</template>

<style scoped>
.cpub-quote-block {
  display: flex;
  gap: 0;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border2);
}

.cpub-quote-bar {
  width: 5px;
  background: var(--accent);
  flex-shrink: 0;
}

.cpub-quote-body {
  flex: 1;
  padding: 16px 20px;
}

.cpub-quote-text {
  font-size: 16px;
  font-style: italic;
  line-height: 1.7;
  color: var(--text);
  outline: none;
  min-height: 1.7em;
}

.cpub-quote-text:empty::before {
  content: attr(data-placeholder);
  color: var(--text-faint);
  pointer-events: none;
}

.cpub-quote-attribution {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  background: transparent;
  border: none;
  outline: none;
}

.cpub-quote-attribution::placeholder {
  color: var(--text-faint);
}
</style>
