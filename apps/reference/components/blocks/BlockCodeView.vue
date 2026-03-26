<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const language = computed(() => (props.content.language as string) || '');
const filename = computed(() => (props.content.filename as string) || '');
const code = computed(() => (props.content.code as string) || '');

const highlightedHtml = ref('');
const copied = ref(false);

async function highlight(): Promise<void> {
  if (!code.value) { highlightedHtml.value = ''; return; }
  try {
    const { codeToHtml } = await import('shiki');
    highlightedHtml.value = await codeToHtml(code.value, {
      lang: language.value || 'text',
      theme: 'github-dark',
    });
  } catch {
    highlightedHtml.value = '';
  }
}

onMounted(() => {
  watch([code, language], highlight, { immediate: true });
});

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
        <i :class="copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'"></i>
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <div v-if="highlightedHtml" class="cpub-code-body cpub-code-highlighted" v-html="highlightedHtml" />
    <pre v-else class="cpub-code-body"><code>{{ code }}</code></pre>
  </div>
</template>

<style scoped>
.cpub-block-code {
  border: 2px solid var(--border);
  overflow: hidden;
  margin: 20px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

.cpub-code-lang {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.cpub-code-filename {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  flex: 1;
}

.cpub-code-copy {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  background: transparent;
  border: 1px solid var(--border);
  padding: 3px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  transition: color 0.1s;
  margin-left: auto;
}

.cpub-code-copy:hover {
  color: var(--text);
}

.cpub-code-body {
  margin: 0;
  padding: 16px;
  background: #0d1117;
  color: #e6edf3;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}

.cpub-code-highlighted {
  padding: 0;
}

.cpub-code-highlighted :deep(pre) {
  margin: 0;
  padding: 16px;
  background: #0d1117 !important;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
}

.cpub-code-highlighted :deep(code) {
  font-family: var(--font-mono);
}
</style>
