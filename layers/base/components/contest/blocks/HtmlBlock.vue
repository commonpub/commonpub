<script setup lang="ts">
/**
 * Edit component for the `html` block — a raw HTML snippet usable in any contest
 * body. A monospace textarea plus a live sanitized preview (the same rich-HTML
 * sanitizer + color neutralization the view uses), so the author sees exactly what
 * will render and that scripts/event handlers are stripped. House block-edit
 * contract: `content` in, `update` out. Provided via BLOCK_COMPONENTS_KEY.
 */
import { sanitizeRichHtml } from '../../../composables/useSanitize';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const html = computed(() => (typeof props.content.html === 'string' ? props.content.html : ''));
const safePreview = computed(() => sanitizeRichHtml(html.value, { neutralizeColors: true }));

function setHtml(v: string): void {
  emit('update', { html: v });
}
</script>

<template>
  <div class="cpub-htmledit">
    <div class="cpub-htmledit-header">
      <div class="cpub-htmledit-icon"><i class="fa-solid fa-code"></i></div>
      <span class="cpub-htmledit-title">HTML</span>
      <span class="cpub-htmledit-note">Scripts &amp; event handlers are stripped on render.</span>
    </div>
    <textarea
      class="cpub-htmledit-input"
      :value="html"
      rows="6"
      spellcheck="false"
      placeholder="<p>Paste or write raw HTML…</p>"
      aria-label="Raw HTML"
      @input="setHtml(($event.target as HTMLTextAreaElement).value)"
    />
    <div v-if="safePreview" class="cpub-htmledit-preview">
      <span class="cpub-htmledit-preview-label">Preview</span>
      <!-- eslint-disable-next-line vue/no-v-html — sanitizeRichHtml is the XSS barrier -->
      <div class="cpub-md-html" v-html="safePreview" />
    </div>
  </div>
</template>

<style scoped>
.cpub-htmledit { border: var(--border-width-default) solid var(--border2); background: var(--surface); }
.cpub-htmledit-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: var(--border-width-default) solid var(--border2); background: var(--surface2); }
.cpub-htmledit-icon { font-size: 12px; color: var(--accent); }
.cpub-htmledit-title { font-size: 12px; font-weight: 600; }
.cpub-htmledit-note { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); margin-left: auto; }
.cpub-htmledit-input {
  width: 100%; padding: 10px 12px; font-family: var(--font-mono); font-size: 12px; line-height: 1.6;
  background: var(--surface); border: none; color: var(--text); outline: none; resize: vertical;
  white-space: pre; tab-size: 2;
}
.cpub-htmledit-input:focus { background: var(--surface2); }
.cpub-htmledit-input::placeholder { color: var(--text-faint); }
.cpub-htmledit-preview { border-top: var(--border-width-default) solid var(--border2); padding: 12px 14px; }
.cpub-htmledit-preview-label { display: block; font-family: var(--font-mono); font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 8px; }
</style>
