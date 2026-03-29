<script setup lang="ts">
import { markdownToBlockTuples } from '@commonpub/editor';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
  import: [md: string, mode: 'append' | 'replace'];
}>();

const activeTab = ref<'paste' | 'file'>('paste');
const markdownText = ref('');
const mode = ref<'append' | 'replace'>('append');
const dragging = ref(false);

const preview = computed(() => {
  if (!markdownText.value.trim()) return null;
  try {
    const blocks = markdownToBlockTuples(markdownText.value);
    const typeCounts: Record<string, number> = {};
    for (const [type] of blocks) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    return { total: blocks.length, types: typeCounts };
  } catch {
    return null;
  }
});

function handleImport(): void {
  if (!markdownText.value.trim()) return;
  emit('import', markdownText.value, mode.value);
  markdownText.value = '';
  emit('close');
}

function handleFileDrop(e: DragEvent): void {
  dragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.type === 'text/markdown' || file.type === 'text/plain')) {
    readFile(file);
  }
}

function handleFileSelect(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) readFile(file);
}

async function readFile(file: File): Promise<void> {
  markdownText.value = await file.text();
  activeTab.value = 'paste'; // Switch to paste tab to show content
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="md-import-overlay" @click.self="emit('close')">
      <div class="md-import-dialog">
        <div class="md-import-header">
          <h2><i class="fa-brands fa-markdown"></i> Import Markdown</h2>
          <button class="md-import-close" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="md-import-tabs">
          <button :class="{ active: activeTab === 'paste' }" @click="activeTab = 'paste'">
            <i class="fa-solid fa-paste"></i> Paste
          </button>
          <button :class="{ active: activeTab === 'file' }" @click="activeTab = 'file'">
            <i class="fa-solid fa-file-arrow-up"></i> File
          </button>
        </div>

        <div class="md-import-body">
          <div v-if="activeTab === 'paste'" class="md-import-paste">
            <textarea
              v-model="markdownText"
              class="md-import-textarea"
              placeholder="Paste your markdown content here..."
              spellcheck="false"
            />
          </div>

          <div
            v-else
            class="md-import-drop"
            :class="{ dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="handleFileDrop"
          >
            <div class="md-import-drop-content">
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <p>Drop a <strong>.md</strong> file here</p>
              <span>or</span>
              <label class="md-import-file-btn">
                Browse files
                <input type="file" accept=".md,.markdown,text/markdown,text/plain" hidden @change="handleFileSelect" />
              </label>
            </div>
          </div>

          <!-- Preview -->
          <div v-if="preview" class="md-import-preview">
            <span class="md-import-preview-label">Preview:</span>
            <span class="md-import-preview-count">{{ preview.total }} blocks</span>
            <span v-for="(count, type) in preview.types" :key="type" class="md-import-preview-tag">
              {{ count }}× {{ type }}
            </span>
          </div>
        </div>

        <div class="md-import-footer">
          <div class="md-import-mode">
            <label>
              <input v-model="mode" type="radio" value="append" /> Append to end
            </label>
            <label>
              <input v-model="mode" type="radio" value="replace" /> Replace all content
            </label>
          </div>
          <div class="md-import-actions">
            <button class="md-import-cancel" @click="emit('close')">Cancel</button>
            <button class="md-import-btn" :disabled="!markdownText.trim()" @click="handleImport">
              <i class="fa-solid fa-file-import"></i> Import
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.md-import-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: var(--color-surface-overlay); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}

.md-import-dialog {
  width: 100%; max-width: 640px;
  background: var(--surface); border: 2px solid var(--border);
  box-shadow: var(--shadow-xl);
  display: flex; flex-direction: column;
  max-height: 80vh;
}

.md-import-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 2px solid var(--border);
}

.md-import-header h2 {
  font-family: var(--font-mono); font-size: 1rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em;
  display: flex; align-items: center; gap: 8px;
}

.md-import-close {
  width: 32px; height: 32px; border: 2px solid transparent;
  background: none; color: var(--text-dim); cursor: pointer; font-size: 14px;
}
.md-import-close:hover { background: var(--surface2); border-color: var(--border); }

.md-import-tabs {
  display: flex; gap: 0; border-bottom: 2px solid var(--border);
}
.md-import-tabs button {
  flex: 1; padding: 10px; border: none; background: none;
  font-size: 0.8125rem; font-weight: 500; color: var(--text-dim);
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
  border-bottom: 2px solid transparent;
}
.md-import-tabs button.active {
  color: var(--accent); border-bottom-color: var(--accent);
}

.md-import-body { flex: 1; overflow-y: auto; }

.md-import-textarea {
  width: 100%; min-height: 240px; resize: vertical;
  border: none; outline: none; padding: 16px;
  font-family: var(--font-mono); font-size: 12px; line-height: 1.6;
  color: var(--text); background: var(--bg);
}

.md-import-drop {
  padding: 40px 20px; text-align: center;
  border: 2px dashed var(--border); margin: 16px;
  transition: border-color 0.15s, background 0.15s;
}
.md-import-drop.dragging {
  border-color: var(--accent); background: var(--accent-bg, rgba(91, 156, 246, 0.05));
}
.md-import-drop-content { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-dim); }
.md-import-drop-content i { font-size: 32px; color: var(--text-faint); }
.md-import-drop-content span { font-size: 11px; color: var(--text-faint); }

.md-import-file-btn {
  padding: 6px 14px; background: var(--surface2); border: 2px solid var(--border);
  font-size: 12px; color: var(--text); cursor: pointer;
}
.md-import-file-btn:hover { background: var(--surface3); }

.md-import-preview {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 10px 16px; border-top: 2px solid var(--border);
  font-size: 11px;
}
.md-import-preview-label { color: var(--text-faint); font-weight: 600; }
.md-import-preview-count { color: var(--accent); font-weight: 700; font-family: var(--font-mono); }
.md-import-preview-tag {
  padding: 2px 6px; background: var(--surface2);
  font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);
}

.md-import-footer {
  padding: 12px 20px; border-top: 2px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}

.md-import-mode {
  display: flex; gap: 14px; font-size: 12px; color: var(--text-dim);
}
.md-import-mode label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.md-import-mode input { accent-color: var(--accent); }

.md-import-actions { display: flex; gap: 8px; }
.md-import-cancel {
  padding: 7px 14px; border: 2px solid var(--border);
  background: var(--surface); color: var(--text-dim); font-size: 12px; cursor: pointer;
}
.md-import-btn {
  padding: 7px 16px; border: 2px solid var(--accent);
  background: var(--accent); color: var(--color-text-inverse); font-size: 12px;
  font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;
}
.md-import-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.md-import-btn:hover:not(:disabled) { opacity: 0.85; }

@media (max-width: 640px) {
  .md-import-dialog { max-width: 100%; max-height: 90vh; }
  .md-import-mode { flex-direction: column; gap: 6px; }
}
</style>
