<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();

const expression = computed(() => (props.content.expression as string) || '');
const label = computed(() => (props.content.label as string) || '');
</script>

<template>
  <div class="cpub-block-math">
    <div v-if="label" class="cpub-math-label">{{ label }}</div>
    <pre class="cpub-math-expression"><code>{{ expression }}</code></pre>
  </div>
</template>

<style scoped>
.cpub-block-math {
  font-family: var(--font-mono);
  background: var(--border);
  border: 2px solid var(--border);
  padding: 16px 18px;
  margin: 16px 0;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-math-label {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-bottom: 8px;
}

.cpub-math-expression {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--surface);
  white-space: pre-wrap;
  word-break: break-all;
}

.cpub-math-expression code {
  font-family: inherit;
}
</style>
