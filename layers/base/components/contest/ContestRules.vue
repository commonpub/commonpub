<script setup lang="ts">
const props = defineProps<{
  rules: string;
}>();

const ruleLines = computed(() =>
  props.rules.split('\n').filter((line) => line.trim().length > 0),
);
</script>

<template>
  <div class="cpub-rules-section">
    <div class="cpub-sec-head">
      <h2><i class="fa fa-file-lines" style="color: var(--purple);"></i> Rules</h2>
    </div>
    <div class="cpub-rules-card">
      <ol v-if="ruleLines.length > 1" class="cpub-rules-list">
        <li v-for="(line, i) in ruleLines" :key="i" class="cpub-rule-item">{{ line }}</li>
      </ol>
      <div v-else class="cpub-rules-text">{{ rules }}</div>
    </div>
  </div>
</template>

<style scoped>
.cpub-sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.cpub-sec-head h2 { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

.cpub-rules-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; box-shadow: var(--shadow-md); }
.cpub-rules-list { padding-left: 20px; margin: 0; }
.cpub-rule-item { font-size: 12px; color: var(--text-dim); line-height: 1.7; margin-bottom: 6px; }
.cpub-rule-item:last-child { margin-bottom: 0; }
.cpub-rules-text { font-size: 12px; color: var(--text-dim); line-height: 1.7; white-space: pre-line; }
</style>
