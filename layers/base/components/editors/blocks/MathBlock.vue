<script setup lang="ts">
const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const expression = computed(() => (props.content.expression as string) ?? '');
const notation = computed(() => (props.content.notation as string) ?? 'latex');

function updateExpression(value: string): void {
  emit('update', { ...props.content, expression: value });
}
</script>

<template>
  <div class="cpub-math-edit">
    <div class="cpub-math-edit-header"><i class="fa-solid fa-square-root-variable"></i> Math Notation</div>
    <div class="cpub-math-edit-body">
      <textarea
        class="cpub-math-textarea"
        :value="expression"
        placeholder="e.g. f(x) = \sum_{i=1}^{n} w_i \cdot x_i + b"
        rows="3"
        @input="updateExpression(($event.target as HTMLTextAreaElement).value)"
      />
      <div class="cpub-math-hint">Enter LaTeX or plain math notation</div>
    </div>
  </div>
</template>

<style scoped>
.cpub-math-edit { border: 2px solid var(--border2); background: var(--surface); }
.cpub-math-edit-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--surface2); border-bottom: 2px solid var(--border2); display: flex; align-items: center; gap: 8px; }
.cpub-math-edit-header i { color: var(--purple); }
.cpub-math-edit-body { padding: 12px; }
.cpub-math-textarea { width: 100%; font-family: var(--font-mono); font-size: 13px; background: var(--surface2); border: 2px solid var(--border2); padding: 8px; color: var(--text); outline: none; resize: vertical; }
.cpub-math-textarea:focus { border-color: var(--accent); }
.cpub-math-hint { font-size: 10px; color: var(--text-faint); margin-top: 4px; }
</style>
