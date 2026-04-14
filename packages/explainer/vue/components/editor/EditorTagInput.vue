<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ tags: string[] }>();
const emit = defineEmits<{ 'update:tags': [tags: string[]] }>();

const input = ref('');

function addTag(): void {
  const tag = input.value.trim().replace(/,/g, '');
  if (tag && !props.tags.includes(tag)) {
    emit('update:tags', [...props.tags, tag]);
  }
  input.value = '';
}

function removeTag(idx: number): void {
  emit('update:tags', props.tags.filter((_, i) => i !== idx));
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
  if (e.key === 'Backspace' && !input.value && props.tags.length) removeTag(props.tags.length - 1);
}
</script>

<template>
  <div class="cpub-tag-input">
    <span v-for="(tag, i) in tags" :key="tag" class="cpub-tag-chip">
      {{ tag }}
      <button type="button" class="cpub-tag-remove" @click="removeTag(i)">&times;</button>
    </span>
    <input v-model="input" type="text" class="cpub-tag-field" placeholder="Add tag..." @keydown="onKeydown" @blur="addTag" />
  </div>
</template>

<style scoped>
.cpub-tag-input { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border: var(--border-width-default) solid var(--border); background: var(--surface); min-height: 34px; align-items: center; }
.cpub-tag-chip { display: flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--surface2); border: var(--border-width-default) solid var(--border2); font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-tag-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 0 2px; }
.cpub-tag-remove:hover { color: var(--red); }
.cpub-tag-field { border: none; outline: none; background: transparent; font-size: 11px; color: var(--text); flex: 1; min-width: 60px; }
.cpub-tag-field::placeholder { color: var(--text-faint); }
</style>
