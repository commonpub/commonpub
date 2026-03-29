<script setup lang="ts">
import { markdownToBlockTuples } from '@commonpub/editor';
import type { BlockTuple } from '@commonpub/editor';

const props = defineProps<{
  content: { source: string };
}>();

const emit = defineEmits<{
  update: [content: { source: string }];
}>();

/** Type-safe block content accessors — cast content to record for dynamic key access */
function bStr(block: BlockTuple, key: string): string {
  return String((block[1] as Record<string, unknown>)[key] ?? '');
}
function bNum(block: BlockTuple, key: string): number {
  return Number((block[1] as Record<string, unknown>)[key]) || 0;
}

const viewMode = ref<'edit' | 'split' | 'preview'>('split');
const source = ref(props.content.source || '');

watch(() => props.content.source, (val) => {
  if (val !== source.value) source.value = val;
});

const previewBlocks = computed(() => {
  if (!source.value.trim()) return [];
  try {
    return markdownToBlockTuples(source.value);
  } catch {
    return [];
  }
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function handleInput(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update', { source: source.value });
  }, 300);
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div class="md-block" :class="[`md-block--${viewMode}`]">
    <div class="md-block-toolbar">
      <span class="md-block-label"><i class="fa-brands fa-markdown"></i> Markdown</span>
      <div class="md-block-modes">
        <button :class="{ active: viewMode === 'edit' }" @click="viewMode = 'edit'" title="Edit">
          <i class="fa-solid fa-code"></i>
        </button>
        <button :class="{ active: viewMode === 'split' }" @click="viewMode = 'split'" title="Split">
          <i class="fa-solid fa-columns"></i>
        </button>
        <button :class="{ active: viewMode === 'preview' }" @click="viewMode = 'preview'" title="Preview">
          <i class="fa-solid fa-eye"></i>
        </button>
      </div>
    </div>

    <div class="md-block-content">
      <div v-if="viewMode !== 'preview'" class="md-block-editor">
        <textarea
          v-model="source"
          class="md-block-textarea"
          placeholder="Write markdown here..."
          spellcheck="false"
          @input="handleInput"
        />
      </div>

      <div v-if="viewMode !== 'edit'" class="md-block-preview">
        <div v-if="!previewBlocks.length" class="md-block-empty">
          <i class="fa-solid fa-file-lines"></i>
          <span>Preview will appear here</span>
        </div>
        <div v-else class="md-block-preview-blocks">
          <div v-for="(block, i) in previewBlocks" :key="i" class="md-preview-block">
            <template v-if="block[0] === 'heading'">
              <component :is="`h${bNum(block, 'level')}`" class="md-preview-heading">
                {{ bStr(block, 'text') }}
              </component>
            </template>
            <template v-else-if="block[0] === 'text'">
              <div class="md-preview-text" v-html="bStr(block, 'html')" />
            </template>
            <template v-else-if="block[0] === 'code'">
              <pre class="md-preview-code"><code>{{ bStr(block, 'code') }}</code></pre>
            </template>
            <template v-else-if="block[0] === 'image'">
              <figure class="md-preview-figure">
                <img :src="bStr(block, 'src')" :alt="bStr(block, 'alt')" />
              </figure>
            </template>
            <template v-else-if="block[0] === 'callout'">
              <div :class="['md-preview-callout', `md-callout--${bStr(block, 'variant')}`]">
                <div v-html="bStr(block, 'html')" />
              </div>
            </template>
            <template v-else-if="block[0] === 'quote'">
              <blockquote class="md-preview-quote" v-html="bStr(block, 'html')" />
            </template>
            <template v-else-if="block[0] === 'divider'">
              <hr class="md-preview-hr" />
            </template>
            <template v-else>
              <div class="md-preview-unknown">{{ block[0] }} block</div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.md-block {
  border: 2px solid var(--border);
  border-radius: 0;
  background: var(--surface);
  overflow: hidden;
}

.md-block-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--surface2);
  border-bottom: 2px solid var(--border);
}

.md-block-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 6px;
}

.md-block-modes {
  display: flex;
  gap: 2px;
  background: var(--surface3);
  border-radius: 0;
  padding: 2px;
}

.md-block-modes button {
  padding: 3px 8px;
  border: none;
  border-radius: 0;
  background: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 11px;
}

.md-block-modes button.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.md-block-content {
  display: flex;
  min-height: 200px;
}

.md-block--edit .md-block-editor { flex: 1; }
.md-block--preview .md-block-preview { flex: 1; }
.md-block--split .md-block-editor { flex: 1; border-right: 2px solid var(--border); }
.md-block--split .md-block-preview { flex: 1; }

.md-block-textarea {
  width: 100%;
  height: 100%;
  min-height: 200px;
  resize: vertical;
  border: none;
  outline: none;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--text);
  background: var(--bg);
  tab-size: 2;
}

.md-block-preview {
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
  overflow-y: auto;
}

.md-block-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  gap: 8px;
  color: var(--text-faint);
  font-size: 12px;
}

.md-preview-heading { margin-bottom: 8px; }
.md-preview-text { margin-bottom: 8px; }
.md-preview-code {
  background: var(--surface2);
  border: 2px solid var(--border);
  border-radius: 0;
  padding: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  overflow-x: auto;
  margin-bottom: 8px;
}
.md-preview-figure img { max-width: 100%; border-radius: 0; }
.md-preview-callout {
  padding: 10px 12px;
  border-radius: 0;
  border-left: 3px solid;
  margin-bottom: 8px;
  font-size: 12px;
}
.md-callout--info { background: var(--teal-bg); border-color: var(--teal); }
.md-callout--tip { background: var(--green-bg); border-color: var(--green); }
.md-callout--warning { background: var(--yellow-bg); border-color: var(--yellow); }
.md-callout--danger { background: var(--red-bg); border-color: var(--red); }
.md-preview-quote {
  border-left: 3px solid var(--border);
  padding-left: 12px;
  color: var(--text-dim);
  font-style: italic;
  margin-bottom: 8px;
}
.md-preview-hr { border: none; border-top: 2px solid var(--border); margin: 12px 0; }
.md-preview-unknown {
  padding: 6px 10px;
  background: var(--surface2);
  border-radius: 0;
  font-size: 11px;
  color: var(--text-faint);
  margin-bottom: 8px;
}
</style>
