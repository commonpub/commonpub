<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const language = computed(() => (props.content.language as string) || '');
const filename = computed(() => (props.content.filename as string) || '');
const code = computed(() => (props.content.code as string) || '');

const highlightedHtml = ref('');
const copied = ref(false);
const highlighterReady = ref(false);

let highlighterInstance: any = null;

async function getHighlighter() {
  if (highlighterInstance) return highlighterInstance;
  try {
    const shiki = await import('shiki');
    highlighterInstance = await shiki.createHighlighter({
      themes: ['github-dark'],
      langs: [
        'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'c', 'cpp',
        'csharp', 'ruby', 'php', 'swift', 'kotlin', 'html', 'css', 'scss',
        'json', 'yaml', 'toml', 'markdown', 'bash', 'shell', 'sql', 'graphql',
        'dockerfile', 'vue', 'svelte', 'jsx', 'tsx', 'xml',
      ],
    });
    highlighterReady.value = true;
    return highlighterInstance;
  } catch (e) {
    console.warn('[BlockCodeView] Failed to load shiki:', e);
    return null;
  }
}

async function highlight(): Promise<void> {
  if (!code.value) { highlightedHtml.value = ''; return; }

  const highlighter = await getHighlighter();
  if (!highlighter) { highlightedHtml.value = ''; return; }

  try {
    const lang = language.value || 'text';
    const loadedLangs = highlighter.getLoadedLanguages();
    const effectiveLang = loadedLangs.includes(lang) ? lang : 'text';

    highlightedHtml.value = highlighter.codeToHtml(code.value, {
      lang: effectiveLang,
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
}

.cpub-code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--surface-2, var(--surface2, #161b22));
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
  color: var(--text-2, var(--text-faint, #8b949e));
  flex: 1;
}

.cpub-code-copy {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-2, var(--text-faint, #8b949e));
  background: transparent;
  border: 1px solid var(--border);
  padding: 3px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.cpub-code-copy:hover {
  color: var(--text-1, var(--text, #e6edf3));
  border-color: var(--text-2, var(--text-dim));
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

/* Ensure shiki's inline styles are not overridden */
.cpub-code-highlighted :deep(span) {
  font-family: var(--font-mono);
}
</style>
