<script setup lang="ts">
import type { BlockTuple } from '@commonpub/editor';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
  imported: [result: ImportedContent];
}>();

interface ImportedContent {
  title: string;
  description: string;
  coverImageUrl: string | null;
  content: BlockTuple[];
  tags: string[];
  partial: boolean;
  meta: Record<string, unknown>;
}

const url = ref('');
const loading = ref(false);
const error = ref('');
const result = ref<ImportedContent | null>(null);
const confirmed = ref(false);

const canSubmit = computed(() => {
  try {
    const parsed = new URL(url.value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
});

async function handleFetch(): Promise<void> {
  if (!canSubmit.value) return;
  loading.value = true;
  error.value = '';
  result.value = null;

  try {
    const data = await $fetch<ImportedContent>('/api/content/import', {
      method: 'POST',
      body: { url: url.value },
    });
    result.value = data;
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message
      || (err as Error)?.message
      || 'Failed to import content';
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

function handleImport(): void {
  if (!result.value || !confirmed.value) return;
  emit('imported', result.value);
  resetState();
  emit('close');
}

function handleClose(): void {
  resetState();
  emit('close');
}

function resetState(): void {
  url.value = '';
  loading.value = false;
  error.value = '';
  result.value = null;
  confirmed.value = false;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') handleClose();
  if (e.key === 'Enter' && !result.value && canSubmit.value && !loading.value) handleFetch();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="cpub-import-overlay" @click.self="handleClose" @keydown="onKeydown">
      <div class="cpub-import-dialog" role="dialog" aria-labelledby="import-url-title" aria-modal="true">
        <div class="cpub-import-header">
          <h2 id="import-url-title"><i class="fa-solid fa-file-import"></i> Import from URL</h2>
          <button class="cpub-import-close" aria-label="Close" @click="handleClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- URL input -->
        <div class="cpub-import-url-row">
          <input
            v-model="url"
            type="url"
            class="cpub-import-url-input"
            placeholder="https://example.com/article-to-import"
            aria-label="URL to import"
            :disabled="loading"
            @keydown.enter.prevent="handleFetch"
          />
          <button
            class="cpub-import-fetch-btn"
            :disabled="!canSubmit || loading"
            @click="handleFetch"
          >
            <i v-if="loading" class="fa-solid fa-circle-notch fa-spin"></i>
            <template v-else>Fetch</template>
          </button>
        </div>

        <!-- Error -->
        <div v-if="error" class="cpub-import-error" role="alert">
          <i class="fa-solid fa-triangle-exclamation"></i> {{ error }}
        </div>

        <!-- Results preview -->
        <div v-if="result" class="cpub-import-preview">
          <div v-if="result.partial" class="cpub-import-warning">
            <i class="fa-solid fa-exclamation-circle"></i>
            Only partial content could be extracted. You may need to add missing sections manually.
          </div>

          <div class="cpub-import-preview-card">
            <img
              v-if="result.coverImageUrl"
              :src="result.coverImageUrl"
              alt=""
              class="cpub-import-preview-cover"
            />
            <div class="cpub-import-preview-info">
              <h3 class="cpub-import-preview-title">{{ result.title || 'Untitled' }}</h3>
              <p v-if="result.description" class="cpub-import-preview-desc">{{ result.description }}</p>
              <div class="cpub-import-preview-stats">
                <span class="cpub-import-stat">{{ result.content.length }} blocks</span>
                <span v-if="result.tags.length" class="cpub-import-stat">{{ result.tags.length }} tags</span>
                <span v-if="result.meta.difficulty" class="cpub-import-stat">{{ result.meta.difficulty }}</span>
                <span v-if="result.meta.wordCount" class="cpub-import-stat">~{{ result.meta.wordCount }} words</span>
              </div>
            </div>
          </div>

          <div v-if="result.tags.length" class="cpub-import-tags">
            <span v-for="tag in result.tags.slice(0, 10)" :key="tag" class="cpub-import-tag">{{ tag }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="result" class="cpub-import-footer">
          <label class="cpub-import-confirm">
            <input v-model="confirmed" type="checkbox" />
            <span>I am the original author of this content</span>
          </label>
          <div class="cpub-import-actions">
            <button class="cpub-import-cancel" @click="handleClose">Cancel</button>
            <button
              class="cpub-import-btn"
              :disabled="!confirmed"
              @click="handleImport"
            >
              <i class="fa-solid fa-file-import"></i> Import Content
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cpub-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: var(--color-surface-overlay, rgba(0, 0, 0, 0.5));
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.cpub-import-dialog {
  width: 100%;
  max-width: 560px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.cpub-import-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-import-header h2 {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-import-close {
  width: 32px;
  height: 32px;
  border: var(--border-width-default) solid transparent;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cpub-import-close:hover {
  background: var(--surface2);
  border-color: var(--border);
}

.cpub-import-url-row {
  display: flex;
  gap: 0;
  padding: 16px 20px;
}

.cpub-import-url-input {
  flex: 1;
  padding: 10px 14px;
  border: var(--border-width-default) solid var(--border);
  border-right: none;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
}
.cpub-import-url-input:focus {
  border-color: var(--accent);
}

.cpub-import-fetch-btn {
  padding: 10px 20px;
  border: var(--border-width-default) solid var(--accent);
  background: var(--accent);
  color: var(--color-text-inverse);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cpub-import-fetch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cpub-import-fetch-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.cpub-import-error {
  margin: 0 20px 12px;
  padding: 10px 14px;
  background: var(--red-bg, rgba(255, 80, 80, 0.08));
  border: var(--border-width-default) solid var(--red, #f55);
  color: var(--red, #f55);
  font-size: 12px;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-import-preview {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 16px;
}

.cpub-import-warning {
  padding: 10px 14px;
  background: var(--yellow-bg, rgba(255, 200, 50, 0.08));
  border: var(--border-width-default) solid var(--yellow, #fc3);
  color: var(--yellow, #fc3);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.cpub-import-preview-card {
  display: flex;
  gap: 14px;
  padding: 14px;
  border: var(--border-width-default) solid var(--border);
  background: var(--bg);
}

.cpub-import-preview-cover {
  width: 100px;
  height: 72px;
  object-fit: cover;
  border: var(--border-width-default) solid var(--border);
  flex-shrink: 0;
}

.cpub-import-preview-info {
  flex: 1;
  min-width: 0;
}

.cpub-import-preview-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cpub-import-preview-desc {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cpub-import-preview-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.cpub-import-stat {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-faint);
  padding: 2px 6px;
  background: var(--surface2);
}

.cpub-import-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.cpub-import-tag {
  padding: 2px 8px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
}

.cpub-import-footer {
  padding: 14px 20px;
  border-top: var(--border-width-default) solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cpub-import-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
}
.cpub-import-confirm input {
  accent-color: var(--accent);
}

.cpub-import-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.cpub-import-cancel {
  padding: 7px 14px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
}
.cpub-import-cancel:hover {
  background: var(--surface2);
}

.cpub-import-btn {
  padding: 7px 16px;
  border: var(--border-width-default) solid var(--accent);
  background: var(--accent);
  color: var(--color-text-inverse);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cpub-import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cpub-import-btn:hover:not(:disabled) {
  opacity: 0.85;
}

@media (max-width: 640px) {
  .cpub-import-dialog {
    max-width: 100%;
    max-height: 90vh;
  }
  .cpub-import-preview-cover {
    display: none;
  }
}
</style>
