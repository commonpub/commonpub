<script setup lang="ts">
/**
 * Tool list block — list of required tools with name and notes.
 */
interface Tool { name: string; url?: string; required?: boolean; notes?: string; }

const props = defineProps<{
  content: Record<string, unknown>;
}>();

const emit = defineEmits<{
  update: [content: Record<string, unknown>];
}>();

const tools = computed(() => (props.content.tools as Tool[]) ?? []);

function updateTool(index: number, field: string, value: unknown): void {
  const updated = [...tools.value];
  updated[index] = { ...updated[index]!, [field]: value };
  emit('update', { tools: updated });
}

function addTool(): void {
  emit('update', { tools: [...tools.value, { name: '', required: true }] });
}

function removeTool(index: number): void {
  emit('update', { tools: tools.value.filter((_: Tool, i: number) => i !== index) });
}
</script>

<template>
  <div class="cpub-tools-block">
    <div class="cpub-tools-header">
      <i class="fa-solid fa-wrench cpub-tools-icon"></i>
      <span class="cpub-tools-title">Tools Required</span>
      <button class="cpub-tools-add" @click="addTool"><i class="fa-solid fa-plus"></i> Add tool</button>
    </div>
    <div class="cpub-tools-list">
      <div v-for="(tool, i) in tools" :key="i" class="cpub-tool-item">
        <input class="cpub-tool-name" type="text" :value="tool.name" placeholder="Tool name..." @input="updateTool(i, 'name', ($event.target as HTMLInputElement).value)" />
        <input class="cpub-tool-note" type="text" :value="tool.notes ?? ''" placeholder="Notes..." @input="updateTool(i, 'notes', ($event.target as HTMLInputElement).value)" />
        <button class="cpub-tool-remove" @click="removeTool(i)"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div v-if="tools.length === 0" class="cpub-tools-empty" @click="addTool">
        <i class="fa-solid fa-plus"></i> Add your first tool
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-tools-block { border: 2px solid var(--border2); background: var(--surface); }
.cpub-tools-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 2px solid var(--border2); background: var(--surface2); }
.cpub-tools-icon { font-size: 12px; color: var(--accent); }
.cpub-tools-title { font-size: 12px; font-weight: 600; flex: 1; }
.cpub-tools-add { font-family: var(--font-mono); font-size: 10px; padding: 3px 8px; background: transparent; border: 2px solid var(--border2); color: var(--text-dim); cursor: pointer; display: flex; align-items: center; gap: 4px; }
.cpub-tools-add:hover { border-color: var(--accent); color: var(--accent); }
.cpub-tools-list { padding: 8px; }
.cpub-tool-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--border2); }
.cpub-tool-item:last-child { border-bottom: none; }
.cpub-tool-name { flex: 1; font-size: 12px; font-weight: 500; background: transparent; border: none; outline: none; color: var(--text); }
.cpub-tool-name::placeholder { color: var(--text-faint); }
.cpub-tool-note { flex: 1; font-size: 11px; background: transparent; border: none; outline: none; color: var(--text-dim); }
.cpub-tool-note::placeholder { color: var(--text-faint); }
.cpub-tool-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 10px; }
.cpub-tool-remove:hover { color: var(--red); }
.cpub-tools-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-faint); cursor: pointer; }
.cpub-tools-empty:hover { color: var(--accent); background: var(--accent-bg); }
</style>
