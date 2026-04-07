<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ content: Record<string, unknown> }>();
const emit = defineEmits<{ update: [content: Record<string, unknown>] }>();

const label = computed(() => (props.content.label as string) ?? '');

function updateLabel(value: string): void {
  emit('update', { ...props.content, label: value });
}
</script>

<template>
  <div class="cpub-checkpoint-edit">
    <div class="cpub-checkpoint-edit-header"><i class="fa-solid fa-circle-check"></i> Checkpoint</div>
    <div class="cpub-checkpoint-edit-body">
      <input class="cpub-checkpoint-input" :value="label" placeholder="e.g. Section 1 complete — you understand backpropagation!" @input="updateLabel(($event.target as HTMLInputElement).value)" />
    </div>
  </div>
</template>

<style scoped>
.cpub-checkpoint-edit { border: var(--border-width-default) solid var(--green-border); background: var(--surface); }
.cpub-checkpoint-edit-header { padding: 8px 12px; font-size: 12px; font-weight: 600; background: var(--green-bg); border-bottom: var(--border-width-default) solid var(--green-border); display: flex; align-items: center; gap: 8px; color: var(--green); }
.cpub-checkpoint-edit-body { padding: 12px; }
.cpub-checkpoint-input { width: 100%; font-size: 13px; background: transparent; border: none; border-bottom: var(--border-width-default) solid var(--border2); padding: 6px 0; outline: none; color: var(--text); }
.cpub-checkpoint-input::placeholder { color: var(--text-faint); }
</style>
