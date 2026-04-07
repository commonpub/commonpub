<script setup lang="ts">
import { BlockCanvas, EditorBlocks, EditorSection, EditorTagInput, EditorVisibility, type BlockEditor, type BlockTypeGroup } from '@commonpub/editor/vue';

const props = defineProps<{
  blockEditor: BlockEditor;
  metadata: Record<string, unknown>;
}>();

const emit = defineEmits<{
  'update:metadata': [metadata: Record<string, unknown>];
}>();

function updateMeta(key: string, value: unknown): void {
  emit('update:metadata', { ...props.metadata, [key]: value });
}

const blockTypes: BlockTypeGroup[] = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Paragraph', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Section Header', icon: 'fa-heading', description: 'H1-H3 heading' },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Blockquote with attribution' },
    ],
  },
  {
    name: 'Media',
    blocks: [
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or embed image' },
      { type: 'video', label: 'Video Embed', icon: 'fa-film', description: 'YouTube, Vimeo, etc.' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Visual separator' },
    ],
  },
  {
    name: 'Rich',
    blocks: [
      { type: 'code_block', label: 'Code Block', icon: 'fa-code', description: 'Syntax highlighted code' },
      { type: 'callout', label: 'Callout', icon: 'fa-circle-info', description: 'Tip, warning, or note', attrs: { variant: 'info' } },
      { type: 'embed', label: 'Embed', icon: 'fa-globe', description: 'External embed' },
      { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown block' },
    ],
  },
];

// --- Left panel tabs ---
const activeLeftTab = ref<'modules' | 'structure' | 'assets'>('modules');

// --- Structure: sections derived from H2 headings ---
interface Section {
  id: string;
  title: string;
  blockCount: number;
  index: number;
}

const sections = computed<Section[]>(() => {
  const result: Section[] = [];
  const blocks = props.blockEditor.blocks.value;
  let currentSection: Section | null = null;
  let sectionIdx = 0;

  for (const block of blocks) {
    if (block.type === 'heading' && (block.content.level === 2 || block.content.level === 1)) {
      if (currentSection) result.push(currentSection);
      sectionIdx++;
      currentSection = {
        id: block.id,
        title: (block.content.text as string) || 'Untitled section',
        blockCount: 1,
        index: sectionIdx,
      };
    } else if (currentSection) {
      currentSection.blockCount++;
    }
  }
  if (currentSection) result.push(currentSection);
  return result;
});

function scrollToSection(sectionId: string): void {
  props.blockEditor.selectBlock(sectionId);
}

// --- Assets ---
const uploadedFiles = ref<Array<{ name: string; size: string; type: string }>>([]);

function onAssetUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'content');
  $fetch<{ url: string; originalName: string; size: number }>('/api/files/upload', { method: 'POST', body: formData })
    .then((res) => {
      uploadedFiles.value.unshift({
        name: res.originalName || file.name,
        size: `${(res.size / 1024).toFixed(0)} KB`,
        type: file.type.startsWith('image/') ? 'image' : 'file',
      });
    })
    .catch(() => { /* silent */ });
}

// --- Cover image ---
const coverImageUrl = computed(() => (props.metadata.coverImageUrl as string) || '');

function onCoverUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'cover');
  $fetch<{ url: string }>('/api/files/upload', { method: 'POST', body: formData })
    .then((res) => { updateMeta('coverImageUrl', res.url); })
    .catch(() => { /* silent fallback */ });
}

function onCoverUrl(): void {
  const url = window.prompt('Enter image URL:');
  if (url) updateMeta('coverImageUrl', url);
}

function removeCover(): void {
  updateMeta('coverImageUrl', '');
}

// --- Right panel ---
const openSections = ref<Record<string, boolean>>({
  content: true, seo: false, publishing: true, cover: false,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

const tags = computed(() => (props.metadata.tags as string[]) || []);
function onTagsUpdate(newTags: string[]): void { updateMeta('tags', newTags); }
const visibility = computed(() => (props.metadata.visibility as string) || 'public');
function onVisibilityUpdate(val: string): void { updateMeta('visibility', val); }

// --- Word count / status bar ---
const wordCount = computed(() => {
  let count = 0;
  for (const block of props.blockEditor.blocks.value) {
    const html = (block.content.html as string) || '';
    const text = (block.content.text as string) || '';
    const code = (block.content.code as string) || '';
    const combined = html.replace(/<[^>]*>/g, ' ') + ' ' + text + ' ' + code;
    count += combined.split(/\s+/).filter((w) => w.length > 0).length;
  }
  return count;
});
const readTime = computed(() => Math.max(1, Math.round(wordCount.value / 200)));
const blockCount = computed(() => props.blockEditor.blocks.value.length);

// --- Mobile sidebar toggles ---
const mobileLeftOpen = ref(false);
const mobileRightOpen = ref(false);
function toggleMobileLeft(): void {
  mobileLeftOpen.value = !mobileLeftOpen.value;
  if (mobileLeftOpen.value) mobileRightOpen.value = false;
}
function toggleMobileRight(): void {
  mobileRightOpen.value = !mobileRightOpen.value;
  if (mobileRightOpen.value) mobileLeftOpen.value = false;
}
function closeMobileSidebars(): void {
  mobileLeftOpen.value = false;
  mobileRightOpen.value = false;
}

// --- Canvas toolbar ---
const viewportMode = ref<'desktop' | 'tablet' | 'mobile'>('desktop');
const canvasMaxWidth = computed(() => {
  if (viewportMode.value === 'mobile') return '375px';
  if (viewportMode.value === 'tablet') return '768px';
  return '680px';
});
</script>

<template>
  <div class="cpub-ae-shell">
    <!-- Mobile sidebar toggles -->
    <div class="cpub-ae-mobile-toggles">
      <button class="cpub-ae-mobile-btn" aria-label="Toggle modules panel" @click="toggleMobileLeft"><i class="fa-solid fa-layer-group"></i></button>
      <button class="cpub-ae-mobile-btn" aria-label="Toggle properties panel" @click="toggleMobileRight"><i class="fa-solid fa-sliders"></i></button>
    </div>
    <div v-if="mobileLeftOpen || mobileRightOpen" class="cpub-ae-mobile-overlay" @click="closeMobileSidebars" />

    <!-- LEFT: Tabbed panel (Modules / Structure / Assets) -->
    <aside class="cpub-ae-left" :class="{ 'cpub-ae-sidebar-open': mobileLeftOpen }" aria-label="Editor sidebar">
      <div class="cpub-ae-left-tabs">
        <button class="cpub-ae-left-tab" :class="{ active: activeLeftTab === 'modules' }" @click="activeLeftTab = 'modules'">Modules</button>
        <button class="cpub-ae-left-tab" :class="{ active: activeLeftTab === 'structure' }" @click="activeLeftTab = 'structure'">Structure</button>
        <button class="cpub-ae-left-tab" :class="{ active: activeLeftTab === 'assets' }" @click="activeLeftTab = 'assets'">Assets</button>
      </div>

      <!-- Modules tab -->
      <div v-if="activeLeftTab === 'modules'" class="cpub-ae-left-body">
        <EditorBlocks :groups="blockTypes" :block-editor="blockEditor" />
      </div>

      <!-- Structure tab -->
      <div v-else-if="activeLeftTab === 'structure'" class="cpub-ae-left-body">
        <div class="cpub-ae-structure-list">
          <div
            v-for="section in sections"
            :key="section.id"
            class="cpub-ae-structure-item"
            @click="scrollToSection(section.id)"
          >
            <span class="cpub-ae-structure-num">{{ String(section.index).padStart(2, '0') }}</span>
            <span class="cpub-ae-structure-title">{{ section.title }}</span>
            <span class="cpub-ae-structure-badge">{{ section.blockCount }} blk</span>
          </div>
          <p v-if="sections.length === 0" class="cpub-ae-structure-hint">
            Add H2 headings to create sections. Each heading starts a new section.
          </p>
        </div>
      </div>

      <!-- Assets tab -->
      <div v-else class="cpub-ae-left-body">
        <label class="cpub-ae-assets-drop">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <div class="cpub-ae-assets-drop-label">Drop files here</div>
          <div class="cpub-ae-assets-drop-sub">JPG, PNG, GIF, SVG, PDF</div>
          <input type="file" class="cpub-sr-only" @change="onAssetUpload">
        </label>
        <div v-if="uploadedFiles.length > 0" class="cpub-ae-assets-list">
          <div class="cpub-ae-assets-heading">Recent Uploads</div>
          <div
            v-for="(file, idx) in uploadedFiles"
            :key="idx"
            class="cpub-ae-asset-item"
          >
            <div class="cpub-ae-asset-icon">
              <i :class="file.type === 'image' ? 'fa-solid fa-image' : 'fa-solid fa-file'" />
            </div>
            <div class="cpub-ae-asset-info">
              <div class="cpub-ae-asset-name">{{ file.name }}</div>
              <div class="cpub-ae-asset-size">{{ file.size }}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- CENTER: Canvas with toolbar -->
    <div class="cpub-ae-center">
      <!-- Canvas toolbar -->
      <div class="cpub-ae-canvas-toolbar">
        <button class="cpub-ae-tool-btn" title="Previous block"><i class="fa-solid fa-chevron-up"></i></button>
        <button class="cpub-ae-tool-btn" title="Next block"><i class="fa-solid fa-chevron-down"></i></button>
        <div class="cpub-ae-toolbar-divider" />
        <div class="cpub-ae-viewport-tabs">
          <button class="cpub-ae-viewport-tab" :class="{ active: viewportMode === 'desktop' }" title="Desktop" @click="viewportMode = 'desktop'"><i class="fa-solid fa-desktop"></i></button>
          <button class="cpub-ae-viewport-tab" :class="{ active: viewportMode === 'tablet' }" title="Tablet" @click="viewportMode = 'tablet'"><i class="fa-solid fa-tablet-screen-button"></i></button>
          <button class="cpub-ae-viewport-tab" :class="{ active: viewportMode === 'mobile' }" title="Mobile" @click="viewportMode = 'mobile'"><i class="fa-solid fa-mobile-screen"></i></button>
        </div>
      </div>

      <!-- Scrollable canvas -->
      <div class="cpub-ae-canvas">
        <div class="cpub-ae-canvas-inner" :style="{ maxWidth: canvasMaxWidth }">
          <BlockCanvas :block-editor="blockEditor" :block-types="blockTypes" />
        </div>
      </div>

      <!-- Status bar -->
      <div class="cpub-ae-statusbar">
        <div class="cpub-ae-status-item">
          <i class="fa-solid fa-layer-group"></i>
          <span>{{ blockCount }} blocks &middot; {{ sections.length }} sections</span>
        </div>
        <div class="cpub-ae-status-sep" />
        <div class="cpub-ae-status-item">
          <i class="fa-solid fa-align-justify"></i>
          <span>{{ wordCount.toLocaleString() }} words</span>
        </div>
        <div class="cpub-ae-status-sep" />
        <div class="cpub-ae-status-item">
          <i class="fa-regular fa-clock"></i>
          <span>~{{ readTime }} min read</span>
        </div>
      </div>
    </div>

    <!-- RIGHT: Properties -->
    <aside class="cpub-ae-right" :class="{ 'cpub-ae-sidebar-open': mobileRightOpen }" aria-label="Document properties">
      <div class="cpub-ae-right-header">
        <span class="cpub-ae-right-title">Properties</span>
      </div>
      <div class="cpub-ae-right-body">
        <!-- Content / Metadata -->
        <EditorSection title="Content" icon="fa-pen-nib" :open="openSections.content" @toggle="toggleSection('content')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Slug</label>
            <input class="cpub-ep-input" type="text" :value="metadata.slug" placeholder="auto-generated" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Description</label>
            <textarea class="cpub-ep-textarea" rows="3" :value="metadata.description as string" placeholder="Brief description..." @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
          </div>
          <div class="cpub-ae-cover" :class="{ 'has-image': !!coverImageUrl }">
            <template v-if="coverImageUrl">
              <img :src="coverImageUrl" alt="Cover image" class="cpub-ae-cover-img" />
              <div class="cpub-ae-cover-actions">
                <button class="cpub-ae-cover-btn" @click="removeCover"><i class="fa-solid fa-trash"></i> Remove</button>
                <label class="cpub-ae-cover-btn">
                  <i class="fa-solid fa-arrow-up-from-bracket"></i> Replace
                  <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
                </label>
              </div>
            </template>
            <template v-else>
              <div class="cpub-ae-cover-placeholder">
                <div class="cpub-ae-cover-icon"><i class="fa-regular fa-image"></i></div>
                <span class="cpub-ae-cover-text">Cover image</span>
              </div>
              <div class="cpub-ae-cover-overlay">
                <label class="cpub-ae-cover-btn primary">
                  <i class="fa-solid fa-arrow-up-from-bracket"></i> Upload
                  <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
                </label>
                <button class="cpub-ae-cover-btn" @click="onCoverUrl"><i class="fa-solid fa-link"></i> From URL</button>
              </div>
            </template>
          </div>
        </EditorSection>

        <!-- SEO -->
        <EditorSection title="SEO" icon="fa-magnifying-glass" :open="openSections.seo" @toggle="toggleSection('seo')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Meta Description</label>
            <textarea class="cpub-ep-textarea" rows="3" :value="metadata.seoDescription as string" placeholder="Search engine description..." @input="updateMeta('seoDescription', ($event.target as HTMLTextAreaElement).value)" />
            <span class="cpub-ep-hint">{{ ((metadata.seoDescription as string) || '').length }}/160</span>
          </div>
        </EditorSection>

        <!-- Publishing -->
        <EditorSection title="Publishing" icon="fa-rocket" :open="openSections.publishing" @toggle="toggleSection('publishing')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Visibility</label>
            <EditorVisibility :model-value="visibility" @update:model-value="onVisibilityUpdate" />
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Category</label>
            <select class="cpub-ep-select" :value="metadata.category || ''" @change="updateMeta('category', ($event.target as HTMLSelectElement).value)">
              <option value="">Select category</option>
              <option value="technology">Technology</option>
              <option value="hardware">Hardware</option>
              <option value="ai-ml">AI &amp; Machine Learning</option>
              <option value="tutorial">Tutorial</option>
              <option value="deep-dive">Deep Dive</option>
              <option value="opinion">Opinion</option>
            </select>
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Tags</label>
            <EditorTagInput :tags="tags" @update:tags="onTagsUpdate" />
          </div>
        </EditorSection>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.cpub-ae-shell { display: flex; flex: 1; overflow: hidden; }

/* Left panel */
.cpub-ae-left { width: 240px; flex-shrink: 0; background: var(--surface); border-right: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ae-left-tabs { display: flex; border-bottom: var(--border-width-default) solid var(--border); flex-shrink: 0; }
.cpub-ae-left-tab {
  flex: 1; padding: 8px 4px; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; text-align: center;
  background: none; border: none; color: var(--text-dim); cursor: pointer;
  border-bottom: var(--border-width-default) solid transparent; margin-bottom: -2px;
}
.cpub-ae-left-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--accent-bg); }
.cpub-ae-left-body { flex: 1; overflow-y: auto; }

/* Structure */
.cpub-ae-structure-list { padding: 8px; }
.cpub-ae-structure-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer;
  border: var(--border-width-default) solid transparent; transition: all 0.1s;
}
.cpub-ae-structure-item:hover { background: var(--surface2); border-color: var(--border2); }
.cpub-ae-structure-num { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); font-weight: 600; }
.cpub-ae-structure-title { flex: 1; font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-ae-structure-badge { font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); background: var(--surface2); border: var(--border-width-default) solid var(--border2); padding: 1px 6px; }
.cpub-ae-structure-hint { font-size: 11px; color: var(--text-dim); line-height: 1.5; padding: 12px; }

/* Assets */
.cpub-ae-assets-drop {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 20px 12px; margin: 8px; border: 2px dashed var(--border2); cursor: pointer;
  transition: border-color 0.15s, background 0.15s; text-align: center;
}
.cpub-ae-assets-drop:hover { border-color: var(--accent); background: var(--accent-bg); }
.cpub-ae-assets-drop i { font-size: 20px; color: var(--text-faint); }
.cpub-ae-assets-drop-label { font-size: 11px; font-weight: 600; color: var(--text-dim); }
.cpub-ae-assets-drop-sub { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-ae-assets-list { padding: 8px 12px; }
.cpub-ae-assets-heading { font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-faint); padding: 4px 0 10px; }
.cpub-ae-asset-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--surface); border: var(--border-width-default) solid var(--border); cursor: pointer;
  box-shadow: var(--shadow-sm); margin-bottom: 5px;
}
.cpub-ae-asset-icon {
  width: 34px; height: 34px; background: var(--surface2); display: flex;
  align-items: center; justify-content: center; flex-shrink: 0; border: var(--border-width-default) solid var(--border2);
}
.cpub-ae-asset-icon i { font-size: 11px; color: var(--text-faint); }
.cpub-ae-asset-info { flex: 1; min-width: 0; }
.cpub-ae-asset-name { font-size: 10px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.cpub-ae-asset-size { font-family: var(--font-mono); font-size: 8px; color: var(--text-faint); }

/* Center */
.cpub-ae-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Canvas toolbar */
.cpub-ae-canvas-toolbar {
  display: flex; align-items: center; gap: 2px; padding: 4px 12px;
  background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); flex-shrink: 0; min-height: 32px;
}
.cpub-ae-tool-btn {
  width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: var(--surface2); border: var(--border-width-default) solid var(--border); color: var(--text-dim);
  font-size: 9px; cursor: pointer;
}
.cpub-ae-tool-btn:hover { background: var(--surface3); color: var(--text); }
.cpub-ae-toolbar-divider { width: 2px; height: 16px; background: var(--border); margin: 0 6px; }
.cpub-ae-viewport-tabs { display: flex; gap: 0; margin-left: auto; }
.cpub-ae-viewport-tab {
  width: 28px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: none; border: var(--border-width-default) solid var(--border); border-left-width: 0; color: var(--text-faint);
  font-size: 10px; cursor: pointer;
}
.cpub-ae-viewport-tab:first-child { border-left-width: 2px; }
.cpub-ae-viewport-tab.active { background: var(--border); color: var(--color-text-inverse); }
.cpub-ae-viewport-tab:hover:not(.active) { background: var(--surface2); color: var(--text-dim); }

/* Canvas */
.cpub-ae-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-ae-canvas-inner { margin: 0 auto; transition: max-width 0.2s; }

/* Status bar */
.cpub-ae-statusbar {
  height: 26px; background: var(--surface); border-top: var(--border-width-default) solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 18px; flex-shrink: 0;
}
.cpub-ae-status-item {
  display: flex; align-items: center; gap: 5px; font-family: var(--font-mono);
  font-size: 9px; color: var(--text-faint); white-space: nowrap;
}
.cpub-ae-status-item i { font-size: 8px; }
.cpub-ae-status-sep { width: 2px; height: 12px; background: var(--border); }

/* Right panel */
.cpub-ae-right { width: 290px; flex-shrink: 0; background: var(--surface); border-left: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ae-right-header {
  padding: 12px 16px; border-bottom: var(--border-width-default) solid var(--border); display: flex;
  align-items: center; gap: 10px; flex-shrink: 0; min-height: 44px;
}
.cpub-ae-right-title { font-size: 11px; font-weight: 700; color: var(--text); font-family: var(--font-mono); letter-spacing: 0.04em; text-transform: uppercase; }
.cpub-ae-right-body { flex: 1; overflow-y: auto; }

.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

/* Cover image */
.cpub-ae-cover {
  position: relative; width: 100%; aspect-ratio: 16/9; background: var(--surface2);
  border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.cpub-ae-cover-img { width: 100%; height: 100%; object-fit: cover; }
.cpub-ae-cover-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.cpub-ae-cover-icon { font-size: 24px; color: var(--text-faint); }
.cpub-ae-cover-text { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-ae-cover-overlay, .cpub-ae-cover-actions {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--color-surface-scrim); opacity: 0; transition: opacity 0.15s;
}
.cpub-ae-cover:hover .cpub-ae-cover-overlay,
.cpub-ae-cover:hover .cpub-ae-cover-actions,
.cpub-ae-cover:focus-within .cpub-ae-cover-overlay,
.cpub-ae-cover:focus-within .cpub-ae-cover-actions { opacity: 1; }
.cpub-ae-cover-btn {
  font-size: 10px; padding: 5px 10px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono); box-shadow: var(--shadow-sm);
}
.cpub-ae-cover-btn.primary { background: var(--accent); color: var(--color-text-inverse); border-color: var(--accent); }
.cpub-ae-cover-btn:hover { background: var(--surface2); }
.cpub-ae-cover-btn.primary:hover { opacity: 0.9; background: var(--accent); }

/* Mobile sidebar toggles */
.cpub-ae-mobile-toggles { display: none; }
.cpub-ae-mobile-overlay { display: none; }

@media (max-width: 1200px) {
  .cpub-ae-left {
    position: fixed; top: 0; bottom: 0; left: 0; z-index: 200;
    transform: translateX(-100%); transition: transform 0.2s ease;
  }
  .cpub-ae-left.cpub-ae-sidebar-open { transform: translateX(0); }
}

@media (max-width: 1024px) {
  .cpub-ae-right {
    position: fixed; top: 0; bottom: 0; right: 0; z-index: 200;
    transform: translateX(100%); transition: transform 0.2s ease;
  }
  .cpub-ae-right.cpub-ae-sidebar-open { transform: translateX(0); }

  .cpub-ae-mobile-toggles {
    display: flex; position: fixed; bottom: 16px; right: 16px;
    gap: 8px; z-index: 100;
  }
  .cpub-ae-mobile-btn {
    width: 44px; height: 44px; border: var(--border-width-default) solid var(--border); background: var(--surface);
    color: var(--text-dim); font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow-md);
  }
  .cpub-ae-mobile-btn:hover { background: var(--surface2); color: var(--text); }
  .cpub-ae-mobile-overlay {
    display: block; position: fixed; inset: 0;
    background: var(--color-surface-overlay-light); z-index: 199;
  }
}

/* Touch devices: always show cover overlays */
@media (hover: none) {
  .cpub-ae-cover-overlay,
  .cpub-ae-cover-actions { opacity: 1; }
}
</style>
