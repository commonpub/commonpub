<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const language = computed(() => (props.content.language as string) || '');
const filename = computed(() => (props.content.filename as string) || '');
const code = computed(() => (props.content.code as string) || '');
</script>

<template>
  <div class="cpub-block-code">
    <div v-if="language || filename" class="cpub-code-header">
      <span v-if="language" class="cpub-code-lang">{{ language }}</span>
      <span v-if="filename" class="cpub-code-filename">{{ filename }}</span>
    </div>
    <pre class="cpub-code-body"><code>{{ code }}</code></pre>
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
  margin-left: auto;
}

.cpub-code-body {
  margin: 0;
  padding: 16px;
  background: var(--text);
  color: var(--surface);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}
</style>
