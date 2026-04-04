<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();

const language = computed(() => (props.content.language as string) || '');
const filename = computed(() => (props.content.filename as string) || '');
const code = computed(() => (props.content.code as string) || '');

const copied = ref(false);

async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch { /* clipboard API not available */ }
}
</script>

<template>
  <div class="cpub-block-code">
    <div class="cpub-code-header">
      <span v-if="language" class="cpub-code-lang">{{ language }}</span>
      <span v-if="filename" class="cpub-code-filename">{{ filename }}</span>
      <button class="cpub-code-copy" @click="copyCode">
        {{ copied ? '&#10003; Copied' : 'Copy' }}
      </button>
    </div>
    <pre class="cpub-code-body"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.cpub-block-code { border: var(--border-width-default) solid var(--border); overflow: hidden; margin: 20px 0; }
.cpub-code-header { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: #161b22; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-code-lang { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #7ee787; }
.cpub-code-filename { font-family: var(--font-mono); font-size: 10px; color: #8b949e; flex: 1; }
.cpub-code-copy { font-family: var(--font-mono); font-size: 10px; color: #8b949e; background: transparent; border: var(--border-width-default) solid #30363d; padding: 3px 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-left: auto; }
.cpub-code-copy:hover { color: #e6edf3; border-color: #8b949e; }
.cpub-code-body { margin: 0; padding: 16px; font-family: var(--font-mono); font-size: 13px; line-height: 1.6; overflow-x: auto; background: #0d1117; color: #e6edf3; }
.cpub-code-body code { font-family: inherit; background: none; border: none; padding: 0; color: inherit; }
</style>
