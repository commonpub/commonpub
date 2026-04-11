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
    name: 'Basic',
    blocks: [
      { type: 'paragraph', label: 'Text', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section header' },
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or embed' },
      { type: 'code_block', label: 'Code Block', icon: 'fa-code', description: 'Syntax highlighted code' },
    ],
  },
  {
    name: 'Project',
    blocks: [
      { type: 'partsList', label: 'Parts List', icon: 'fa-list-check', description: 'BOM table' },
      { type: 'buildStep', label: 'Build Step', icon: 'fa-hammer', description: 'Numbered step' },
      { type: 'toolList', label: 'Tool List', icon: 'fa-wrench', description: 'Required tools' },
      { type: 'downloads', label: 'Downloads', icon: 'fa-download', description: 'File attachments' },
    ],
  },
  {
    name: 'Rich',
    blocks: [
      { type: 'callout', label: 'Tip', icon: 'fa-lightbulb', description: 'Tip callout', attrs: { variant: 'tip' } },
      { type: 'callout', label: 'Warning', icon: 'fa-triangle-exclamation', description: 'Warning callout', attrs: { variant: 'warning' } },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Blockquote' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Visual separator' },
      { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown block' },
    ],
  },
];

// --- SEO preview ---
const seoDomain = computed(() => {
  try { return new URL(useRequestURL().origin).hostname; } catch { return 'example.com'; }
});
const seoPreviewDesc = computed(() => (props.metadata.seoDescription as string) || (props.metadata.description as string) || '');

const openSections = ref<Record<string, boolean>>({
  meta: true, tags: true, visibility: true, cover: false, banner: false, seo: false, checklist: true,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

const difficulties = ['beginner', 'intermediate', 'advanced'] as const;

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

// --- Banner image ---
const bannerUrl = computed(() => (props.metadata.bannerUrl as string) || '');

function onBannerUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', 'cover');
  $fetch<{ url: string }>('/api/files/upload', { method: 'POST', body: formData })
    .then((res) => { updateMeta('bannerUrl', res.url); })
    .catch(() => {});
}

function removeBanner(): void {
  updateMeta('bannerUrl', '');
}

const tags = computed(() => (props.metadata.tags as string[]) || []);
function onTagsUpdate(newTags: string[]): void { updateMeta('tags', newTags); }
const visibility = computed(() => (props.metadata.visibility as string) || 'public');
function onVisibilityUpdate(val: string): void { updateMeta('visibility', val); }

const checklist = computed(() => [
  { label: 'Has cover image', pass: !!(props.metadata.coverImageUrl) },
  { label: 'Has description', pass: !!((props.metadata.description as string)?.length) },
  { label: 'Has tags', pass: !!(tags.value.length) },
  { label: 'Has difficulty set', pass: !!(props.metadata.difficulty) },
  { label: 'Has build time', pass: !!(props.metadata.buildTime) },
  { label: 'Has cost estimate', pass: !!(props.metadata.estimatedCost) },
]);
const checklistDone = computed(() => checklist.value.filter((c) => c.pass).length);

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

// --- Inline title (local ref avoids textarea re-render clobbering) ---
const titleRef = ref((props.metadata.title as string) || '');
watch(() => props.metadata.title, (v) => { if (v !== titleRef.value) titleRef.value = (v as string) || ''; });
watch(titleRef, (v) => updateMeta('title', v));

// --- Canvas toolbar ---
const canvasRef = ref<{ toggleMark: (mark: string) => void; toggleLink: () => void; getActiveMarks: () => Record<string, boolean> } | null>(null);
const viewportMode = ref<'desktop' | 'tablet' | 'mobile'>('desktop');
const canvasMaxWidth = computed(() => {
  if (viewportMode.value === 'mobile') return '375px';
  if (viewportMode.value === 'tablet') return '768px';
  return '820px';
});

// --- Status bar ---
const wordCount = computed(() => {
  let count = 0;
  for (const block of props.blockEditor.blocks.value) {
    const html = (block.content.html as string) || '';
    const text = (block.content.text as string) || '';
    const code = (block.content.code as string) || '';
    const instructions = (block.content.instructions as string) || '';
    const combined = html.replace(/<[^>]*>/g, ' ') + ' ' + text + ' ' + code + ' ' + instructions;
    count += combined.split(/\s+/).filter((w) => w.length > 0).length;
  }
  return count;
});
const blockCount = computed(() => props.blockEditor.blocks.value.length);
</script>

<template>
  <div class="cpub-pe-shell">
    <!-- Mobile sidebar toggles -->
    <div class="cpub-pe-mobile-toggles">
      <button class="cpub-pe-mobile-btn" aria-label="Toggle blocks panel" @click="toggleMobileLeft"><i class="fa-solid fa-layer-group"></i></button>
      <button class="cpub-pe-mobile-btn" aria-label="Toggle settings panel" @click="toggleMobileRight"><i class="fa-solid fa-sliders"></i></button>
    </div>
    <div v-if="mobileLeftOpen || mobileRightOpen" class="cpub-pe-mobile-overlay" @click="closeMobileSidebars" />

    <!-- LEFT: Block Library -->
    <aside class="cpub-pe-library" :class="{ 'cpub-pe-sidebar-open': mobileLeftOpen }" aria-label="Block library">
      <EditorBlocks :groups="blockTypes" :block-editor="blockEditor" />
    </aside>

    <!-- CENTER: Canvas with toolbar -->
    <div class="cpub-pe-center">
      <!-- Canvas toolbar -->
      <div class="cpub-pe-canvas-toolbar">
        <!-- Text formatting -->
        <button class="cpub-pe-tool-btn" title="Bold (Ctrl+B)" @click="canvasRef?.toggleMark('bold')"><i class="fa-solid fa-bold"></i></button>
        <button class="cpub-pe-tool-btn" title="Italic (Ctrl+I)" @click="canvasRef?.toggleMark('italic')"><i class="fa-solid fa-italic"></i></button>
        <button class="cpub-pe-tool-btn" title="Strikethrough" @click="canvasRef?.toggleMark('strike')"><i class="fa-solid fa-strikethrough"></i></button>
        <button class="cpub-pe-tool-btn" title="Inline code" @click="canvasRef?.toggleMark('code')"><i class="fa-solid fa-code"></i></button>
        <button class="cpub-pe-tool-btn" title="Link" @click="canvasRef?.toggleLink()"><i class="fa-solid fa-link"></i></button>
        <div class="cpub-pe-toolbar-divider" />
        <div class="cpub-pe-viewport-tabs">
          <button class="cpub-pe-viewport-tab" :class="{ active: viewportMode === 'desktop' }" title="Desktop" @click="viewportMode = 'desktop'"><i class="fa-solid fa-desktop"></i></button>
          <button class="cpub-pe-viewport-tab" :class="{ active: viewportMode === 'tablet' }" title="Tablet" @click="viewportMode = 'tablet'"><i class="fa-solid fa-tablet-screen-button"></i></button>
          <button class="cpub-pe-viewport-tab" :class="{ active: viewportMode === 'mobile' }" title="Mobile" @click="viewportMode = 'mobile'"><i class="fa-solid fa-mobile-screen"></i></button>
        </div>
      </div>

      <div class="cpub-pe-canvas">
        <div class="cpub-pe-canvas-inner" :style="{ maxWidth: canvasMaxWidth }">
          <!-- Cover image area (inline, like blog editor) -->
          <div class="cpub-pe-cover-inline" :class="{ 'has-image': !!coverImageUrl }">
            <template v-if="coverImageUrl">
              <img :src="coverImageUrl" alt="Cover image" class="cpub-pe-cover-inline-img" />
              <div class="cpub-pe-cover-inline-actions">
                <button class="cpub-pe-cover-btn" @click="removeCover"><i class="fa-solid fa-trash"></i> Remove</button>
                <label class="cpub-pe-cover-btn">
                  <i class="fa-solid fa-arrow-up-from-bracket"></i> Replace
                  <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
                </label>
              </div>
            </template>
            <template v-else>
              <div class="cpub-pe-cover-inline-placeholder">
                <div class="cpub-pe-cover-inline-icon"><i class="fa-regular fa-image"></i></div>
                <span class="cpub-pe-cover-inline-text">Cover image</span>
              </div>
              <div class="cpub-pe-cover-inline-overlay">
                <label class="cpub-pe-cover-btn primary">
                  <i class="fa-solid fa-arrow-up-from-bracket"></i> Upload
                  <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
                </label>
                <button class="cpub-pe-cover-btn" @click="onCoverUrl"><i class="fa-solid fa-link"></i> From URL</button>
              </div>
            </template>
          </div>

          <!-- Title -->
          <textarea
            v-model="titleRef"
            class="cpub-pe-title-inline"
            rows="2"
            placeholder="Project title..."
          />

          <BlockCanvas ref="canvasRef" :block-editor="blockEditor" :block-types="blockTypes" />
        </div>
      </div>

      <!-- Status bar -->
      <div class="cpub-pe-statusbar">
        <div class="cpub-pe-status-item"><i class="fa-solid fa-layer-group"></i> <span>{{ blockCount }} blocks</span></div>
        <div class="cpub-pe-status-sep" />
        <div class="cpub-pe-status-item"><i class="fa-solid fa-align-justify"></i> <span>{{ wordCount.toLocaleString() }} words</span></div>
      </div>
    </div>

    <!-- RIGHT: Settings Panel -->
    <aside class="cpub-pe-settings" :class="{ 'cpub-pe-sidebar-open': mobileRightOpen }" aria-label="Project settings">
      <div class="cpub-pe-settings-body">
        <EditorSection title="Project Meta" icon="fa-sliders" :open="openSections.meta" @toggle="toggleSection('meta')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Slug</label>
            <input class="cpub-ep-input" type="text" :value="metadata.slug" placeholder="project-url-slug" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Difficulty</label>
            <div class="cpub-pe-toggle-group">
              <button
                v-for="d in difficulties"
                :key="d"
                class="cpub-pe-toggle-opt"
                :class="{ active: (metadata.difficulty || 'intermediate') === d }"
                @click="updateMeta('difficulty', d)"
              >{{ d }}</button>
            </div>
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Build Time</label>
            <input class="cpub-ep-input" type="text" :value="metadata.buildTime" placeholder="e.g. 2–4 hours" @input="updateMeta('buildTime', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Estimated Cost</label>
            <input class="cpub-ep-input" type="text" :value="metadata.estimatedCost" placeholder="e.g. $45-60" @input="updateMeta('estimatedCost', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Description</label>
            <textarea class="cpub-ep-textarea" rows="3" :value="metadata.description as string" placeholder="Brief project description..." @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
          </div>
        </EditorSection>

        <EditorSection title="Tags" icon="fa-tag" :open="openSections.tags" @toggle="toggleSection('tags')">
          <EditorTagInput :tags="tags" @update:tags="onTagsUpdate" />
        </EditorSection>

        <EditorSection title="Visibility" icon="fa-eye" :open="openSections.visibility" @toggle="toggleSection('visibility')">
          <EditorVisibility :model-value="visibility" @update:model-value="onVisibilityUpdate" />
        </EditorSection>

        <EditorSection title="Cover Image" icon="fa-image" :open="openSections.cover" @toggle="toggleSection('cover')">
          <div class="cpub-pe-cover" :class="{ 'has-image': !!coverImageUrl }">
            <template v-if="coverImageUrl">
              <img :src="coverImageUrl" alt="Cover image" class="cpub-pe-cover-img" />
              <div class="cpub-pe-cover-actions">
                <button class="cpub-pe-cover-btn" @click="removeCover"><i class="fa-solid fa-trash"></i> Remove</button>
                <label class="cpub-pe-cover-btn">
                  <i class="fa-solid fa-arrow-up-from-bracket"></i> Replace
                  <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
                </label>
              </div>
            </template>
            <template v-else>
              <div class="cpub-pe-cover-placeholder">
                <div class="cpub-pe-cover-icon"><i class="fa-regular fa-image"></i></div>
                <span class="cpub-pe-cover-text">Cover image</span>
              </div>
              <div class="cpub-pe-cover-overlay">
                <label class="cpub-pe-cover-btn primary">
                  <i class="fa-solid fa-arrow-up-from-bracket"></i> Upload
                  <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
                </label>
                <button class="cpub-pe-cover-btn" @click="onCoverUrl"><i class="fa-solid fa-link"></i> From URL</button>
              </div>
            </template>
          </div>
        </EditorSection>

        <!-- Banner Image -->
        <EditorSection title="Banner Image" icon="fa-panorama" :open="openSections.banner" @toggle="toggleSection('banner')">
          <p class="cpub-pe-hint" style="margin-bottom: 8px;">Hero background at the top of the page. Falls back to your profile banner if not set.</p>
          <div v-if="bannerUrl" class="cpub-pe-banner-preview">
            <img :src="bannerUrl" alt="Banner" class="cpub-pe-banner-img" />
            <div class="cpub-pe-banner-actions">
              <button class="cpub-pe-cover-btn" @click="removeBanner"><i class="fa-solid fa-trash"></i> Remove</button>
              <label class="cpub-pe-cover-btn">
                <i class="fa-solid fa-arrow-up-from-bracket"></i> Replace
                <input type="file" accept="image/*" class="cpub-sr-only" @change="onBannerUpload">
              </label>
            </div>
          </div>
          <div v-else>
            <label class="cpub-pe-cover-btn primary" style="display: inline-flex;">
              <i class="fa-solid fa-arrow-up-from-bracket"></i> Upload Banner
              <input type="file" accept="image/*" class="cpub-sr-only" @change="onBannerUpload">
            </label>
          </div>
        </EditorSection>

        <EditorSection title="SEO Preview" icon="fa-brands fa-google" :open="openSections.seo" @toggle="toggleSection('seo')">
          <div class="cpub-seo-card">
            <div class="cpub-seo-url">
              <span class="cpub-seo-favicon">C</span>
              {{ seoDomain }} &rsaquo; project
            </div>
            <div class="cpub-seo-title">{{ (metadata.title as string) || 'Project title' }}</div>
            <div class="cpub-seo-desc">{{ seoPreviewDesc || 'Post description will appear here...' }}</div>
          </div>
          <div class="cpub-pe-field" style="margin-top: 10px;">
            <label class="cpub-pe-flabel">SEO Description</label>
            <textarea class="cpub-pe-textarea" rows="3" :value="metadata.seoDescription as string" placeholder="Search engine description (recommended 50-160 chars)" @input="updateMeta('seoDescription', ($event.target as HTMLTextAreaElement).value)" />
            <span class="cpub-pe-hint cpub-pe-hint-right">{{ ((metadata.seoDescription as string) || '').length }}/160</span>
          </div>
        </EditorSection>

        <EditorSection title="Checklist" icon="fa-circle-check" :open="openSections.checklist" @toggle="toggleSection('checklist')">
          <div class="cpub-pe-checklist">
            <div v-for="item in checklist" :key="item.label" class="cpub-pe-check-item" :class="{ pass: item.pass }">
              <i :class="item.pass ? 'fa-regular fa-square-check' : 'fa-regular fa-square'" :style="{ color: item.pass ? 'var(--green)' : 'var(--text-faint)' }"></i>
              <span>{{ item.label }}</span>
            </div>
          </div>
          <div class="cpub-pe-checklist-summary">
            {{ checklistDone }}/{{ checklist.length }} complete
          </div>
        </EditorSection>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.cpub-pe-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-pe-library { width: 220px; flex-shrink: 0; background: var(--surface); border-right: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-pe-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.cpub-pe-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-pe-canvas-inner { margin: 0 auto; transition: max-width 0.2s; }

/* Inline cover image (in canvas body) */
.cpub-pe-cover-inline {
  position: relative; width: 100%; aspect-ratio: 16/7; background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.cpub-pe-cover-inline-img { width: 100%; height: 100%; object-fit: cover; }
.cpub-pe-cover-inline-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.cpub-pe-cover-inline-icon { font-size: 28px; color: var(--text-faint); }
.cpub-pe-cover-inline-text { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-pe-cover-inline-overlay, .cpub-pe-cover-inline-actions {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--color-surface-scrim); opacity: 0; transition: opacity 0.15s;
}
.cpub-pe-cover-inline:hover .cpub-pe-cover-inline-overlay,
.cpub-pe-cover-inline:hover .cpub-pe-cover-inline-actions,
.cpub-pe-cover-inline:focus-within .cpub-pe-cover-inline-overlay,
.cpub-pe-cover-inline:focus-within .cpub-pe-cover-inline-actions { opacity: 1; }
@media (hover: none) { .cpub-pe-cover-inline-overlay, .cpub-pe-cover-inline-actions { opacity: 1; } }

/* Inline title (in canvas body) */
.cpub-pe-title-inline {
  width: 100%; border: none; outline: none; resize: none; background: transparent;
  font-size: 28px; font-weight: 700; line-height: 1.25; color: var(--text);
  padding: 24px 48px 8px; font-family: var(--font-sans, system-ui);
}
.cpub-pe-title-inline::placeholder { color: var(--text-faint); }

/* Canvas toolbar */
.cpub-pe-canvas-toolbar {
  display: flex; align-items: center; gap: 2px; padding: 4px 12px;
  background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); flex-shrink: 0; min-height: 32px;
}
.cpub-pe-tool-btn {
  width: 28px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: none; border: var(--border-width-default) solid transparent; color: var(--text-dim);
  font-size: 11px; cursor: pointer;
}
.cpub-pe-tool-btn:hover { background: var(--surface2); border-color: var(--border2); color: var(--text); }
.cpub-pe-toolbar-divider { width: 2px; height: 18px; background: var(--border2); margin: 0 6px; }
.cpub-pe-viewport-tabs { display: flex; gap: 0; margin-left: auto; }
.cpub-pe-viewport-tab {
  width: 28px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: none; border: var(--border-width-default) solid var(--border); border-left-width: 0; color: var(--text-faint);
  font-size: 10px; cursor: pointer;
}
.cpub-pe-viewport-tab:first-child { border-left-width: 2px; }
.cpub-pe-viewport-tab.active { background: var(--border); color: var(--color-text-inverse); }
.cpub-pe-viewport-tab:hover:not(.active) { background: var(--surface2); color: var(--text-dim); }

/* Status bar */
.cpub-pe-statusbar {
  height: 26px; background: var(--surface); border-top: var(--border-width-default) solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 18px; flex-shrink: 0;
}
.cpub-pe-status-item {
  display: flex; align-items: center; gap: 5px; font-family: var(--font-mono);
  font-size: 9px; color: var(--text-faint); white-space: nowrap;
}
.cpub-pe-status-item i { font-size: 8px; }
.cpub-pe-status-sep { width: 2px; height: 12px; background: var(--border); }
.cpub-pe-settings { width: 280px; flex-shrink: 0; background: var(--surface); border-left: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-pe-settings-body { flex: 1; overflow-y: auto; }

.cpub-pe-toggle-group { display: flex; border: var(--border-width-default) solid var(--border); overflow: hidden; }
.cpub-pe-toggle-opt { flex: 1; padding: 5px 4px; text-align: center; font-size: 10px; font-family: var(--font-mono); cursor: pointer; color: var(--text-faint); background: transparent; border: none; border-right: var(--border-width-default) solid var(--border); text-transform: capitalize; }
.cpub-pe-toggle-opt:last-child { border-right: none; }
.cpub-pe-toggle-opt:hover { background: var(--surface2); color: var(--text-dim); }
.cpub-pe-toggle-opt.active { background: var(--accent-bg); color: var(--accent); }

.cpub-pe-checklist { display: flex; flex-direction: column; gap: 5px; }
.cpub-pe-check-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-faint); }
.cpub-pe-check-item.pass { color: var(--text); }
.cpub-pe-checklist-summary { margin-top: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--green); }

/* Cover image */
.cpub-pe-cover {
  position: relative; width: 100%; aspect-ratio: 16/9; background: var(--surface2);
  border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.cpub-pe-cover-img { width: 100%; height: 100%; object-fit: cover; }
.cpub-pe-cover-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.cpub-pe-cover-icon { font-size: 24px; color: var(--text-faint); }
.cpub-pe-cover-text { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-pe-cover-overlay, .cpub-pe-cover-actions {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--color-surface-scrim); opacity: 0; transition: opacity 0.15s;
}
.cpub-pe-cover:hover .cpub-pe-cover-overlay,
.cpub-pe-cover:hover .cpub-pe-cover-actions,
.cpub-pe-cover:focus-within .cpub-pe-cover-overlay,
.cpub-pe-cover:focus-within .cpub-pe-cover-actions { opacity: 1; }
.cpub-pe-cover-btn {
  font-size: 10px; padding: 5px 10px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono); box-shadow: var(--shadow-sm);
}
.cpub-pe-cover-btn.primary { background: var(--accent); color: var(--color-text-inverse); border-color: var(--accent); }
.cpub-pe-cover-btn:hover { background: var(--surface2); }
.cpub-pe-cover-btn.primary:hover { opacity: 0.9; background: var(--accent); }
.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

/* Mobile sidebar toggles */
.cpub-pe-mobile-toggles { display: none; }
.cpub-pe-mobile-overlay { display: none; }

@media (max-width: 1200px) {
  .cpub-pe-library {
    position: fixed; top: 0; bottom: 0; left: 0; z-index: 200;
    transform: translateX(-100%); transition: transform 0.2s ease;
  }
  .cpub-pe-library.cpub-pe-sidebar-open { transform: translateX(0); }
}

@media (max-width: 1024px) {
  .cpub-pe-settings {
    position: fixed; top: 0; bottom: 0; right: 0; z-index: 200;
    transform: translateX(100%); transition: transform 0.2s ease;
  }
  .cpub-pe-settings.cpub-pe-sidebar-open { transform: translateX(0); }

  .cpub-pe-mobile-toggles {
    display: flex; position: fixed; bottom: 16px; right: 16px;
    gap: 8px; z-index: 100;
  }
  .cpub-pe-mobile-btn {
    width: 44px; height: 44px; border: var(--border-width-default) solid var(--border); background: var(--surface);
    color: var(--text-dim); font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow-md);
  }
  .cpub-pe-mobile-btn:hover { background: var(--surface2); color: var(--text); }
  .cpub-pe-mobile-overlay {
    display: block; position: fixed; inset: 0;
    background: var(--color-surface-overlay-light); z-index: 199;
  }
}

/* Touch devices: always show cover overlays */
@media (hover: none) {
  .cpub-pe-cover-overlay,
  .cpub-pe-cover-actions { opacity: 1; }
}

/* SEO preview card */
.cpub-seo-card {
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  padding: 14px;
}
.cpub-seo-url {
  font-size: 11px; color: var(--text-faint); margin-bottom: 4px;
  display: flex; align-items: center; gap: 6px;
}
.cpub-seo-favicon {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--accent-bg); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
}
.cpub-seo-title { font-size: 14px; color: var(--accent); font-weight: 500; margin-bottom: 2px; }
.cpub-seo-desc { font-size: 11px; color: var(--text-dim); line-height: 1.5; }

/* Banner preview */
.cpub-pe-banner-preview { position: relative; margin-bottom: 8px; }
.cpub-pe-banner-img { width: 100%; height: 80px; object-fit: cover; display: block; border: var(--border-width-default) solid var(--border); }
.cpub-pe-banner-actions { display: flex; gap: 6px; margin-top: 6px; }
</style>
