<script setup lang="ts">
/**
 * Reusable tag input for editor panels.
 * Used by Article, Blog, Project editors.
 */
const props = defineProps<{
  tags: string[];
}>();

const emit = defineEmits<{
  'update:tags': [tags: string[]];
}>();

const tagInput = ref('');

function addTag(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = tagInput.value.trim().replace(/,$/, '');
    if (val && !props.tags.includes(val)) {
      emit('update:tags', [...props.tags, val]);
    }
    tagInput.value = '';
  }
}

function removeTag(idx: number): void {
  emit('update:tags', props.tags.filter((_: string, i: number) => i !== idx));
}
</script>

<template>
  <div class="cpub-tag-input-wrap">
    <div class="cpub-tag-chips">
      <span v-for="(tag, i) in tags" :key="i" class="cpub-tag-chip">
        {{ tag }}
        <button class="cpub-tag-remove" aria-label="Remove tag" @click="removeTag(i)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </span>
    </div>
    <input
      v-model="tagInput"
      type="text"
      class="cpub-tag-input"
      placeholder="Add tag..."
      aria-label="Add tag"
      @keydown="addTag"
    />
  </div>
</template>

<style scoped>
.cpub-tag-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cpub-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  background: var(--surface2);
  border: 2px solid var(--border2);
  color: var(--text-dim);
}

.cpub-tag-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.cpub-tag-remove {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 9px;
  padding: 0;
  line-height: 1;
}

.cpub-tag-remove:hover {
  color: var(--red);
}

.cpub-tag-input {
  width: 100%;
  background: var(--surface);
  border: 2px solid var(--border);
  padding: 5px 8px;
  font-size: 11px;
  color: var(--text);
  outline: none;
}

.cpub-tag-input:focus {
  border-color: var(--accent);
}

.cpub-tag-input::placeholder {
  color: var(--text-faint);
}
</style>
