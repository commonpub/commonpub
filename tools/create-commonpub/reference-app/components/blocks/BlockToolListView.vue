<script setup lang="ts">
interface Tool {
  name: string;
  url?: string;
  required?: boolean;
  notes?: string;
}

const props = defineProps<{ content: Record<string, unknown> }>();

const tools = computed<Tool[]>(() => {
  const raw = props.content.tools;
  if (!Array.isArray(raw)) return [];
  return raw as Tool[];
});
</script>

<template>
  <div v-if="tools.length > 0" class="cpub-block-tools">
    <div class="cpub-tools-header">
      <i class="fa-solid fa-wrench cpub-tools-icon"></i>
      <span class="cpub-tools-title">Tools Required</span>
      <span class="cpub-tools-count">{{ tools.length }}</span>
    </div>
    <div class="cpub-tools-list">
      <div v-for="(tool, i) in tools" :key="i" class="cpub-tool-item">
        <i class="fa-solid fa-wrench cpub-tool-bullet"></i>
        <span class="cpub-tool-name">
          <a v-if="tool.url" :href="tool.url" target="_blank" rel="noopener">{{ tool.name }}</a>
          <template v-else>{{ tool.name }}</template>
        </span>
        <span v-if="tool.notes" class="cpub-tool-notes">{{ tool.notes }}</span>
        <span v-if="tool.required === false" class="cpub-tool-optional">optional</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-block-tools {
  border: 2px solid var(--border);
  margin: 20px 0;
  overflow: hidden;
  box-shadow: 4px 4px 0 var(--border);
}

.cpub-tools-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

.cpub-tools-icon { font-size: 12px; color: var(--accent); }
.cpub-tools-title { font-size: 12px; font-weight: 600; color: var(--text); flex: 1; }
.cpub-tools-count { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }

.cpub-tools-list { padding: 8px 14px; }

.cpub-tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border2);
  font-size: 13px;
}

.cpub-tool-item:last-child { border-bottom: none; }

.cpub-tool-bullet { font-size: 10px; color: var(--text-faint); flex-shrink: 0; }
.cpub-tool-name { font-weight: 500; color: var(--text); }
.cpub-tool-name a { color: var(--accent); text-decoration: none; }
.cpub-tool-name a:hover { text-decoration: underline; }
.cpub-tool-notes { font-size: 11px; color: var(--text-faint); margin-left: auto; }

.cpub-tool-optional {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-faint);
  border: 1px solid var(--border2);
  padding: 1px 5px;
  text-transform: uppercase;
}
</style>
