<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { ExplainerDocument, ExplainerDocSection, ExplainerThemeRef, ExplainerConclusion } from '@commonpub/explainer';
import { resolveThemePreset } from '@commonpub/explainer';
import { useExplainerTheme } from '../../composables/useExplainerTheme';
import SectionList from './SectionList.vue';
import SectionEditor from './SectionEditor.vue';
import ModulePicker from './ModulePicker.vue';
import DocumentPanel from './DocumentPanel.vue';
import ThemeEditor from './ThemeEditor.vue';
import SectionRenderer from '../viewer/SectionRenderer.vue';
import HeroRenderer from '../viewer/HeroRenderer.vue';
import ConclusionRenderer from '../viewer/ConclusionRenderer.vue';

const props = defineProps<{
  document: ExplainerDocument;
}>();

const emit = defineEmits<{
  'update:document': [doc: ExplainerDocument];
  save: [doc: ExplainerDocument];
}>();

// Local mutable copy of the document
const doc = ref<ExplainerDocument>(JSON.parse(JSON.stringify(props.document)));
const isDirty = ref(false);

watch(() => props.document, (newDoc) => {
  doc.value = JSON.parse(JSON.stringify(newDoc));
  isDirty.value = false;
}, { deep: false });

function emitUpdate(): void {
  isDirty.value = true;
  emit('update:document', JSON.parse(JSON.stringify(doc.value)));
}

// Selected section — either a content section or a pinned item (intro/conclusion)
const selectedId = ref<string | null>(doc.value.sections[0]?.id ?? null);
const pinnedSelection = ref<'intro' | 'conclusion' | null>(null);

const selectedSection = computed<ExplainerDocSection | null>(() =>
  pinnedSelection.value ? null : doc.value.sections.find(s => s.id === selectedId.value) ?? null,
);
const selectedIndex = computed(() =>
  doc.value.sections.findIndex(s => s.id === selectedId.value),
);

function selectPinned(which: 'intro' | 'conclusion'): void {
  pinnedSelection.value = which;
  selectedId.value = null;
}

function selectSection(sectionId: string): void {
  pinnedSelection.value = null;
  selectedId.value = sectionId;
}

// Module picker
const showPicker = ref(false);

// Section CRUD
function generateId(): string {
  return `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function addSection(moduleType: string): void {
  const isLayout = ['hero', 'conclusion', 'text-only'].includes(moduleType);
  const newSection: ExplainerDocSection = {
    id: generateId(),
    anchor: `section-${doc.value.sections.length + 1}`,
    heading: '',
    body: '',
    module: isLayout ? undefined : { type: moduleType, props: {} },
  };

  // Insert after selected or at end
  const idx = selectedIndex.value >= 0 ? selectedIndex.value + 1 : doc.value.sections.length;
  doc.value.sections.splice(idx, 0, newSection);
  selectedId.value = newSection.id;
  emitUpdate();
}

function deleteSection(sectionId: string): void {
  if (doc.value.sections.length <= 1) return;
  const idx = doc.value.sections.findIndex(s => s.id === sectionId);
  if (idx === -1) return;
  doc.value.sections.splice(idx, 1);
  if (selectedId.value === sectionId) {
    selectedId.value = doc.value.sections[Math.min(idx, doc.value.sections.length - 1)]?.id ?? null;
  }
  emitUpdate();
}

function duplicateSection(sectionId: string): void {
  const idx = doc.value.sections.findIndex(s => s.id === sectionId);
  if (idx === -1) return;
  const clone: ExplainerDocSection = JSON.parse(JSON.stringify(doc.value.sections[idx]));
  clone.id = generateId();
  doc.value.sections.splice(idx + 1, 0, clone);
  selectedId.value = clone.id;
  emitUpdate();
}

function moveSection(fromIdx: number, toIdx: number): void {
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= doc.value.sections.length || toIdx >= doc.value.sections.length) return;
  const [moved] = doc.value.sections.splice(fromIdx, 1);
  doc.value.sections.splice(toIdx, 0, moved!);
  emitUpdate();
}

function updateSectionContent(field: string, value: unknown): void {
  if (!selectedSection.value) return;
  const idx = selectedIndex.value;
  if (idx === -1) return;
  (doc.value.sections[idx] as Record<string, unknown>)[field] = value;
  emitUpdate();
}

function updateSectionConfig(config: Record<string, unknown>): void {
  if (!selectedSection.value?.module) return;
  const idx = selectedIndex.value;
  if (idx === -1) return;
  doc.value.sections[idx]!.module = { ...doc.value.sections[idx]!.module!, props: config };
  emitUpdate();
}

// Hero editing
function updateHero(field: string, value: string): void {
  (doc.value.hero as Record<string, unknown>)[field] = value;
  emitUpdate();
}

// Meta editing
function updateMeta(field: string, value: unknown): void {
  (doc.value.meta as Record<string, unknown>)[field] = value;
  emitUpdate();
}

// Conclusion editing
function updateConclusion(conclusion: ExplainerConclusion | undefined): void {
  doc.value.conclusion = conclusion;
  emitUpdate();
}

// Settings editing
function updateSettings(field: string, value: unknown): void {
  if (!doc.value.settings) doc.value.settings = {};
  (doc.value.settings as Record<string, unknown>)[field] = value;
  emitUpdate();
}

// Theme — use composable for font loading + CSS override application
const previewRoot = ref<HTMLElement | null>(null);
const themeRef = computed<ExplainerThemeRef>(() => doc.value.theme);
useExplainerTheme(themeRef, previewRoot);

const showThemeEditor = ref(false);

function updateTheme(theme: ExplainerThemeRef): void {
  doc.value.theme = theme;
  emitUpdate();
}

// Right panel tabs
const rightTab = ref<'preview' | 'document'>('preview');

// Save
function handleSave(): void {
  emit('save', JSON.parse(JSON.stringify(doc.value)));
  isDirty.value = false;
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// Autosave — 10s debounce after any document change
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

watch(doc, () => {
  if (!isDirty.value) return;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (isDirty.value) handleSave();
  }, 10_000);
}, { deep: true });

// Warn before leaving with unsaved changes
function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (isDirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload);
  }
});

onUnmounted(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', onBeforeUnload);
  }
});

// Status
const wordCount = computed(() => {
  let count = 0;
  for (const s of doc.value.sections) {
    const text = `${s.heading} ${s.body} ${s.insight ?? ''} ${s.bridge ?? ''}`;
    count += text.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  }
  return count;
});

const sectionCount = computed(() => doc.value.sections.length);
const interactiveCount = computed(() => doc.value.sections.filter(s => s.module).length);

// Resizable preview panel
const previewWidth = ref(320);
const isResizing = ref(false);

function startResize(e: PointerEvent): void {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = previewWidth.value;

  function onMove(ev: PointerEvent): void {
    const delta = startX - ev.clientX;
    previewWidth.value = Math.max(200, Math.min(600, startWidth + delta));
  }

  function onUp(): void {
    isResizing.value = false;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// Mobile: toggle panels
const mobilePanel = ref<'list' | 'editor' | 'preview'>('editor');
</script>

<template>
  <div class="cpub-explainer-section-editor">
    <!-- Top bar -->
    <div class="cpub-ee-topbar">
      <span class="cpub-ee-topbar-badge">Explainer Editor</span>
      <input
        class="cpub-ee-topbar-title"
        :value="doc.hero.title"
        placeholder="Explainer title"
        @input="updateHero('title', ($event.target as HTMLInputElement).value)"
      />
      <!-- Mobile panel toggles -->
      <div class="cpub-ee-mobile-tabs">
        <button :class="{ active: mobilePanel === 'list' }" @click="mobilePanel = 'list'"><i class="fa-solid fa-list" /></button>
        <button :class="{ active: mobilePanel === 'editor' }" @click="mobilePanel = 'editor'"><i class="fa-solid fa-pen" /></button>
        <button :class="{ active: mobilePanel === 'preview' }" @click="mobilePanel = 'preview'"><i class="fa-solid fa-eye" /></button>
      </div>
      <div class="cpub-ee-topbar-spacer" />

      <!-- Theme: compact label + customize toggle -->
      <span class="cpub-ee-theme-label">Theme</span>
      <button class="cpub-ee-theme-btn" :class="{ active: showThemeEditor }" @click="showThemeEditor = !showThemeEditor">
        <i class="fa-solid fa-palette" />
        <span>{{ typeof doc.theme === 'string' ? doc.theme : doc.theme.preset }}</span>
        <i class="fa-solid" :class="showThemeEditor ? 'fa-chevron-up' : 'fa-chevron-down'" style="font-size: 8px; opacity: 0.5;" />
      </button>

      <button class="cpub-ee-topbar-btn" @click="handleSave" :disabled="!isDirty">
        {{ isDirty ? 'Save' : 'Saved' }}
      </button>
    </div>

    <!-- Theme editor (expands below topbar) -->
    <ThemeEditor
      v-if="showThemeEditor"
      :theme="doc.theme"
      @update:theme="updateTheme"
      @close="showThemeEditor = false"
    />

    <!-- 3-panel layout -->
    <div class="cpub-ee-body">
      <!-- LEFT: Section list -->
      <div class="cpub-ee-left" :class="{ 'cpub-ee-mobile-active': mobilePanel === 'list' }">
        <div class="cpub-ee-left-header">
          <span class="cpub-ee-left-label">Sections</span>
          <span class="cpub-ee-left-count">{{ sectionCount }}</span>
        </div>

        <!-- Hero subtitle -->
        <div class="cpub-ee-subtitle-field">
          <textarea
            class="cpub-ee-subtitle-input"
            :value="doc.hero.subtitle ?? ''"
            placeholder="Hook subtitle..."
            rows="2"
            @input="updateHero('subtitle', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>

        <SectionList
          :sections="doc.sections"
          :selected-id="selectedId"
          :pinned-selection="pinnedSelection"
          @select="selectSection"
          @select-pinned="selectPinned"
          @add="showPicker = true"
          @move="moveSection"
          @delete="deleteSection"
          @duplicate="duplicateSection"
        />
      </div>

      <!-- CENTER: Section editor / Intro editor / Conclusion editor -->
      <div class="cpub-ee-center" :class="{ 'cpub-ee-mobile-active': mobilePanel === 'editor' }">
        <!-- Intro (hero) editor -->
        <div v-if="pinnedSelection === 'intro'" class="cpub-ee-pinned-editor">
          <div class="cpub-ee-pinned-header">
            <i class="fa-solid fa-thumbtack" />
            <span>Introduction</span>
          </div>
          <div class="cpub-ee-pinned-fields">
            <label class="cpub-ee-field-label">Title</label>
            <input
              class="cpub-ee-field-input"
              :value="doc.hero.title"
              placeholder="Explainer title..."
              @input="updateHero('title', ($event.target as HTMLInputElement).value)"
            />
            <label class="cpub-ee-field-label">Subtitle</label>
            <textarea
              class="cpub-ee-field-textarea"
              :value="doc.hero.subtitle ?? ''"
              placeholder="A compelling hook..."
              rows="3"
              @input="updateHero('subtitle', ($event.target as HTMLTextAreaElement).value)"
            />
            <label class="cpub-ee-field-label">Cover Image URL</label>
            <input
              class="cpub-ee-field-input"
              :value="doc.hero.coverImageUrl ?? ''"
              placeholder="https://..."
              @input="updateHero('coverImageUrl', ($event.target as HTMLInputElement).value)"
            />
            <label class="cpub-ee-field-label">Highlight Phrase</label>
            <input
              class="cpub-ee-field-input"
              :value="doc.hero.highlight ?? ''"
              placeholder="Key phrase to emphasize..."
              @input="updateHero('highlight', ($event.target as HTMLInputElement).value)"
            />
            <label class="cpub-ee-field-label">Scroll Hint</label>
            <input
              class="cpub-ee-field-input"
              :value="doc.hero.scrollHint ?? ''"
              placeholder="e.g. Scroll to explore →"
              @input="updateHero('scrollHint', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- Conclusion editor -->
        <div v-else-if="pinnedSelection === 'conclusion'" class="cpub-ee-pinned-editor">
          <div class="cpub-ee-pinned-header">
            <i class="fa-solid fa-thumbtack" />
            <span>Conclusion</span>
          </div>
          <div class="cpub-ee-pinned-fields">
            <label class="cpub-ee-field-label">Heading</label>
            <input
              class="cpub-ee-field-input"
              :value="doc.conclusion?.heading ?? ''"
              placeholder="Wrapping up..."
              @input="updateConclusion({ ...(doc.conclusion ?? { heading: '', body: '' }), heading: ($event.target as HTMLInputElement).value })"
            />
            <label class="cpub-ee-field-label">Body</label>
            <textarea
              class="cpub-ee-field-textarea"
              :value="doc.conclusion?.body ?? ''"
              placeholder="Summary and next steps..."
              rows="6"
              @input="updateConclusion({ ...(doc.conclusion ?? { heading: '', body: '' }), body: ($event.target as HTMLTextAreaElement).value })"
            />
            <label class="cpub-ee-field-label">Call to Action — Label</label>
            <input
              class="cpub-ee-field-input"
              :value="doc.conclusion?.callToAction?.label ?? ''"
              placeholder="e.g. Learn More"
              @input="updateConclusion({ ...(doc.conclusion ?? { heading: '', body: '' }), callToAction: { ...(doc.conclusion?.callToAction ?? { label: '', url: '' }), label: ($event.target as HTMLInputElement).value } })"
            />
            <label class="cpub-ee-field-label">Call to Action — URL</label>
            <input
              class="cpub-ee-field-input"
              :value="doc.conclusion?.callToAction?.url ?? ''"
              placeholder="https://..."
              @input="updateConclusion({ ...(doc.conclusion ?? { heading: '', body: '' }), callToAction: { ...(doc.conclusion?.callToAction ?? { label: '', url: '' }), url: ($event.target as HTMLInputElement).value } })"
            />
          </div>
        </div>

        <!-- Regular section editor -->
        <SectionEditor
          v-else-if="selectedSection"
          :section="selectedSection"
          :index="selectedIndex"
          @update:content="updateSectionContent"
          @update:config="updateSectionConfig"
          @delete="deleteSection(selectedSection!.id)"
          @duplicate="duplicateSection(selectedSection!.id)"
          @move-up="moveSection(selectedIndex, selectedIndex - 1)"
          @move-down="moveSection(selectedIndex, selectedIndex + 1)"
        />
        <div v-else class="cpub-ee-empty">
          <p>Select a section or add a new one.</p>
        </div>
      </div>

      <!-- Resize handle -->
      <div class="cpub-ee-resize-handle" @pointerdown="startResize" />

      <!-- RIGHT: Preview / Document tabs -->
      <div class="cpub-ee-right" :class="{ 'cpub-ee-mobile-active': mobilePanel === 'preview' }" :style="{ width: previewWidth + 'px' }">
        <div class="cpub-ee-right-header">
          <button class="cpub-ee-right-tab" :class="{ active: rightTab === 'preview' }" @click="rightTab = 'preview'">Preview</button>
          <button class="cpub-ee-right-tab" :class="{ active: rightTab === 'document' }" @click="rightTab = 'document'">Document</button>
        </div>

        <!-- Preview tab -->
        <div v-if="rightTab === 'preview'" ref="previewRoot" class="cpub-ee-preview-content">
          <template v-if="pinnedSelection === 'intro'">
            <HeroRenderer :hero="doc.hero" />
          </template>
          <template v-else-if="pinnedSelection === 'conclusion' && doc.conclusion">
            <ConclusionRenderer :conclusion="doc.conclusion" />
          </template>
          <template v-else-if="selectedSection">
            <SectionRenderer
              :key="selectedSection.id"
              :section="selectedSection"
              :index="selectedIndex"
            />
          </template>
          <template v-else>
            <HeroRenderer :hero="doc.hero" />
          </template>
        </div>

        <!-- Document tab -->
        <div v-else class="cpub-ee-document-tab">
          <DocumentPanel
            :document="doc"
            @update:hero="updateHero"
            @update:meta="updateMeta"
            @update:conclusion="updateConclusion"
            @update:settings="updateSettings"
          />
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div class="cpub-ee-status">
      <span class="cpub-ee-stat"><span class="cpub-ee-stat-label">Sections:</span> {{ sectionCount }}</span>
      <span class="cpub-ee-stat"><span class="cpub-ee-stat-label">Interactive:</span> {{ interactiveCount }}</span>
      <span class="cpub-ee-stat"><span class="cpub-ee-stat-label">Words:</span> {{ wordCount }}</span>
      <span class="cpub-ee-stat"><span class="cpub-ee-stat-label">Est:</span> {{ Math.max(2, Math.round(wordCount / 200 + interactiveCount * 2)) }}min</span>
      <span class="cpub-ee-stat"><span class="cpub-ee-stat-label">Theme:</span> {{ doc.theme }}</span>
      <div style="flex: 1" />
      <span class="cpub-ee-stat">
        <span class="cpub-ee-save-dot" :class="isDirty ? 'cpub-ee-save-dirty' : 'cpub-ee-save-clean'" />
        {{ isDirty ? 'Unsaved' : 'Saved' }}
      </span>
    </div>

    <!-- Module picker modal -->
    <ModulePicker v-if="showPicker" @select="addSection" @close="showPicker = false" />
  </div>
</template>

<style scoped>
.cpub-explainer-section-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
}

/* Top bar */
.cpub-ee-topbar {
  height: 44px;
  flex-shrink: 0;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 10px;
}

.cpub-ee-topbar-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cpub-ee-topbar-title {
  flex: 1;
  background: none;
  border: none;
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  outline: none;
  font-family: inherit;
}

.cpub-ee-topbar-spacer { flex: 0; }

.cpub-ee-theme-label {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

.cpub-ee-theme-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.cpub-ee-theme-btn:hover { border-color: var(--accent); color: var(--text); }
.cpub-ee-theme-btn.active { border-color: var(--accent); color: var(--accent); }
.cpub-ee-theme-btn i:first-child { font-size: 11px; }

.cpub-ee-topbar-btn {
  padding: 4px 12px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.cpub-ee-topbar-btn:hover { color: var(--text); border-color: var(--accent); }
.cpub-ee-topbar-btn:disabled { opacity: 0.5; cursor: default; }

/* Body */
.cpub-ee-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Left panel */
.cpub-ee-left {
  width: 224px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: var(--border-width-default) solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.cpub-ee-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-ee-left-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
}

.cpub-ee-left-count {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-faint);
}

.cpub-ee-subtitle-field {
  padding: 8px 12px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-ee-subtitle-input {
  width: 100%;
  padding: 6px 8px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-size: 12px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}

.cpub-ee-subtitle-input:focus { border-color: var(--accent); }

/* Center */
.cpub-ee-center {
  flex: 1;
  overflow-y: auto;
  border-right: var(--border-width-default) solid var(--border);
}

.cpub-ee-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-faint);
  font-size: 13px;
}

/* Resize handle */
.cpub-ee-resize-handle {
  width: 4px;
  flex-shrink: 0;
  background: var(--border);
  cursor: col-resize;
  transition: background 0.15s;
}

.cpub-ee-resize-handle:hover,
.cpub-ee-resize-handle:active {
  background: var(--accent);
}

/* Right: preview + document */
.cpub-ee-right {
  flex-shrink: 0;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cpub-ee-right-tab {
  padding: 6px 10px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  cursor: pointer;
}

.cpub-ee-right-tab:hover { color: var(--text); }
.cpub-ee-right-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.cpub-ee-document-tab {
  flex: 1;
  overflow-y: auto;
}

.cpub-ee-right-header {
  padding: 8px 12px;
  border-bottom: var(--border-width-default) solid var(--border);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cpub-ee-preview-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  transform: scale(0.55);
  transform-origin: top left;
  width: 182%;
}

/* Pinned section editor (intro/conclusion) */
.cpub-ee-pinned-editor {
  padding: 24px;
}

.cpub-ee-pinned-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent);
  margin-bottom: 20px;
}

.cpub-ee-pinned-header i { font-size: 9px; }

.cpub-ee-pinned-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cpub-ee-field-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  margin-top: 8px;
}

.cpub-ee-field-input,
.cpub-ee-field-textarea {
  width: 100%;
  padding: 8px 10px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-size: 13px;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}

.cpub-ee-field-input:focus,
.cpub-ee-field-textarea:focus {
  border-color: var(--accent);
}

.cpub-ee-field-textarea {
  resize: vertical;
  min-height: 60px;
}

/* Status bar */
.cpub-ee-status {
  height: 26px;
  flex-shrink: 0;
  background: var(--surface);
  border-top: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 14px;
}

.cpub-ee-stat {
  font-family: var(--font-mono);
  font-size: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-faint);
}

.cpub-ee-stat-label {
  text-transform: uppercase;
  color: var(--text-dim);
}

.cpub-ee-save-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.cpub-ee-save-clean { background: var(--green); }
.cpub-ee-save-dirty { background: var(--yellow); }

/* Mobile tabs (hidden on desktop) */
.cpub-ee-mobile-tabs {
  display: none;
}

@media (max-width: 1024px) {
  .cpub-ee-resize-handle { display: none; }
  .cpub-ee-right { display: none; width: 100% !important; }
  .cpub-ee-left { display: none; width: 100% !important; }
  .cpub-ee-center { display: none; }

  .cpub-ee-mobile-active { display: flex !important; flex: 1; }

  .cpub-ee-mobile-tabs {
    display: flex;
    gap: 2px;
  }

  .cpub-ee-mobile-tabs button {
    padding: 4px 10px;
    background: none;
    border: var(--border-width-default) solid transparent;
    color: var(--text-faint);
    font-size: 12px;
    cursor: pointer;
  }

  .cpub-ee-mobile-tabs button.active {
    color: var(--accent);
    border-color: var(--accent);
  }

  .cpub-ee-right .cpub-ee-preview-content {
    transform: none;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .cpub-ee-topbar-title { display: none; }
  .cpub-ee-topbar-badge { font-size: 9px; }
}
</style>
