<script setup lang="ts">
import hljs from 'highlight.js/lib/core';

import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import graphql from 'highlight.js/lib/languages/graphql';
import ini from 'highlight.js/lib/languages/ini';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('vue', xml);
hljs.registerLanguage('svelte', xml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('docker', dockerfile);
hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('toml', ini);
hljs.registerLanguage('ini', ini);

const props = defineProps<{ content: Record<string, unknown> }>();

const language = computed(() => (props.content.language as string) || '');
const filename = computed(() => (props.content.filename as string) || '');
const code = computed(() => (props.content.code as string) || '');

const highlightedHtml = computed(() => {
  if (!code.value) return '';
  try {
    const lang = language.value.toLowerCase();
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code.value, { language: lang }).value;
    }
    return hljs.highlightAuto(code.value).value;
  } catch {
    return '';
  }
});

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
        <i :class="copied ? 'fa-solid fa-check' : 'fa-regular fa-copy'"></i>
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <pre class="cpub-code-body hljs"><code v-if="highlightedHtml" v-html="highlightedHtml" /><code v-else>{{ code }}</code></pre>
  </div>
</template>

<style>
/* highlight.js github-dark theme — MUST be unscoped so hljs classes apply to v-html content */
pre.hljs {
  background: #0d1117;
  color: #e6edf3;
}
pre.hljs .hljs-comment,
pre.hljs .hljs-quote { color: #8b949e; font-style: italic; }
pre.hljs .hljs-keyword,
pre.hljs .hljs-selector-tag,
pre.hljs .hljs-type { color: #ff7b72; }
pre.hljs .hljs-literal,
pre.hljs .hljs-number,
pre.hljs .hljs-tag .hljs-attr { color: #79c0ff; }
pre.hljs .hljs-string,
pre.hljs .hljs-addition { color: #a5d6ff; }
pre.hljs .hljs-deletion { color: #ffa198; }
pre.hljs .hljs-regexp,
pre.hljs .hljs-link { color: #a5d6ff; }
pre.hljs .hljs-meta { color: #d2a8ff; }
pre.hljs .hljs-title,
pre.hljs .hljs-section,
pre.hljs .hljs-built_in { color: #d2a8ff; }
pre.hljs .hljs-name,
pre.hljs .hljs-selector-id,
pre.hljs .hljs-selector-class { color: #7ee787; }
pre.hljs .hljs-variable,
pre.hljs .hljs-template-variable { color: #ffa657; }
pre.hljs .hljs-attribute { color: #79c0ff; }
pre.hljs .hljs-symbol,
pre.hljs .hljs-bullet { color: #ffa657; }
pre.hljs .hljs-subst { color: #e6edf3; }
pre.hljs .hljs-title.function_ { color: #d2a8ff; }
pre.hljs .hljs-title.class_ { color: #ffa657; }
</style>

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
  background: #161b22;
  border-bottom: 2px solid var(--border);
}

.cpub-code-lang {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #7ee787;
}

.cpub-code-filename {
  font-family: var(--font-mono);
  font-size: 10px;
  color: #8b949e;
  flex: 1;
}

.cpub-code-copy {
  font-family: var(--font-mono);
  font-size: 10px;
  color: #8b949e;
  background: transparent;
  border: 1px solid #30363d;
  padding: 3px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
}

.cpub-code-copy:hover {
  color: #e6edf3;
  border-color: #8b949e;
}

.cpub-code-body {
  margin: 0;
  padding: 16px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
}

.cpub-code-body code {
  font-family: inherit;
  background: none !important;
  border: none !important;
  padding: 0 !important;
  color: inherit;
}
</style>
