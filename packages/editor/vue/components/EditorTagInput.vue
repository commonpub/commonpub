<script setup lang="ts">
/**
 * Reusable tag input for editor panels.
 * Used by Article, Blog, Project editors.
 */
import { computed, ref } from 'vue';

const props = defineProps<{
  tags: string[];
}>();

const emit = defineEmits<{
  'update:tags': [tags: string[]];
}>();

const tagInput = ref('');

/** Server caps: `tags: z.array(z.string().max(64)).max(20)`. Enforce them HERE —
 *  an over-cap tag is rejected on every later save as an opaque "Validation
 *  failed", with nothing in the UI to say which tag or that a limit exists. */
const TAG_MAX_LEN = 64;
const TAG_MAX_COUNT = 20;

const atLimit = computed(() => props.tags.length >= TAG_MAX_COUNT);

/** Commit whatever is typed. Splits on commas so a PASTED "a, b, c" becomes three
 *  tags instead of one 68-character tag (paste fires no keydown, so the old
 *  comma-key handler never saw it). Over-long tags are truncated, not dropped. */
function commit(): void {
  const parts = tagInput.value
    .split(',')
    .map((t) => t.trim().slice(0, TAG_MAX_LEN))
    .filter(Boolean);
  if (!parts.length) { tagInput.value = ''; return; }
  const next = [...props.tags];
  for (const p of parts) {
    if (next.length >= TAG_MAX_COUNT) break;
    if (!next.includes(p)) next.push(p);
  }
  if (next.length !== props.tags.length) emit('update:tags', next);
  tagInput.value = '';
}

function addTag(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    commit();
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
      :disabled="atLimit"
      :placeholder="atLimit ? `Tag limit reached (${TAG_MAX_COUNT})` : 'Add tag...'"
      aria-label="Add tag"
      @keydown="addTag"
      @blur="commit"
    />
    <span class="cpub-tag-count">{{ tags.length }}/{{ TAG_MAX_COUNT }} tags</span>
  </div>
</template>

<style scoped>
.cpub-tag-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cpub-tag-count {
  font-size: var(--text-label, 10px);
  font-family: var(--font-mono);
  color: var(--text-faint);
  align-self: flex-end;
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
  border: var(--border-width-default) solid var(--border2);
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
  border: var(--border-width-default) solid var(--border);
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
