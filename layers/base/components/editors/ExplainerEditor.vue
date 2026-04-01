<script setup lang="ts">
import type { BlockEditor } from '../../composables/useBlockEditor';
import type { BlockTypeGroup } from './BlockPicker.vue';

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

const activeLeftTab = ref<'modules' | 'structure' | 'assets'>('modules');

// Interactive blocks FIRST — they're the core of an explainer
const blockTypes: BlockTypeGroup[] = [
  {
    name: 'Interactive',
    blocks: [
      { type: 'interactiveSlider', label: 'Range Slider', icon: 'fa-sliders', description: 'Slider with feedback ranges' },
      { type: 'quiz', label: 'Knowledge Check', icon: 'fa-circle-question', description: 'Quiz with answer feedback' },
      { type: 'checkpoint', label: 'Checkpoint', icon: 'fa-flag-checkered', description: 'Section completion marker' },
      { type: 'callout', label: 'Key Insight', icon: 'fa-lightbulb', description: 'Highlight discovery moments', attrs: { variant: 'tip' } },
    ],
  },
  {
    name: 'Content',
    blocks: [
      { type: 'paragraph', label: 'Body Text', icon: 'fa-align-left', description: '2-3 short paragraphs max' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'In-section heading (H2/H3)' },
      { type: 'image', label: 'Diagram', icon: 'fa-image', description: 'Visual explanation' },
      { type: 'code_block', label: 'Code Example', icon: 'fa-code', description: 'Runnable code snippet' },
    ],
  },
  {
    name: 'Data & Viz',
    blocks: [
      { type: 'mathNotation', label: 'Math Block', icon: 'fa-square-root-variable', description: 'Formula or equation' },
      { type: 'embed', label: 'Embed', icon: 'fa-globe', description: 'External interactive' },
      { type: 'callout', label: 'Warning', icon: 'fa-triangle-exclamation', description: 'Important caveat', attrs: { variant: 'warning' } },
      { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown block' },
    ],
  },
  {
    name: 'Structure',
    blocks: [
      { type: 'sectionHeader', label: 'Section Header', icon: 'fa-heading', description: 'Tag + title + intro — starts a section' },
      { type: 'horizontal_rule', label: 'Section Divider', icon: 'fa-minus', description: 'Visual break' },
    ],
  },
];

// Interactive block types for counting
const INTERACTIVE_TYPES = new Set(['interactiveSlider', 'slider', 'quiz', 'checkpoint']);

// --- Structure: sections from sectionHeader blocks (fallback to H2 headings) ---
interface ExplainerSection {
  id: string;
  title: string;
  blockCount: number;
  interactiveCount: number;
  index: number;
}

const structureSections = computed<ExplainerSection[]>(() => {
  const result: ExplainerSection[] = [];
  const blocks = props.blockEditor.blocks.value;
  let current: ExplainerSection | null = null;
  let idx = 0;

  // Check if any sectionHeader blocks exist
  const hasSectionHeaders = blocks.some(b => b.type === 'sectionHeader');
  const sectionType = hasSectionHeaders ? 'sectionHeader' : 'heading';

  for (const block of blocks) {
    const isSectionStart = sectionType === 'sectionHeader'
      ? block.type === 'sectionHeader'
      : block.type === 'heading' && ((block.content.level as number) ?? 2) <= 2;

    if (isSectionStart) {
      if (current) result.push(current);
      idx++;
      const title = sectionType === 'sectionHeader'
        ? (block.content.title as string) || 'Untitled section'
        : (block.content.text as string) || 'Untitled section';
      current = {
        id: block.id,
        title,
        blockCount: 1,
        interactiveCount: 0,
        index: idx,
      };
    } else if (current) {
      current.blockCount++;
      if (INTERACTIVE_TYPES.has(block.type)) {
        current.interactiveCount++;
      }
    }
  }
  if (current) result.push(current);
  return result;
});

// Total interactive blocks across all content
const totalInteractives = computed(() => {
  return props.blockEditor.blocks.value.filter(b => INTERACTIVE_TYPES.has(b.type)).length;
});

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

const openSections = ref<Record<string, boolean>>({
  section: true, difficulty: true, visibility: false, cover: false,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

const tags = computed(() => (props.metadata.tags as string[]) || []);
function onTagsUpdate(newTags: string[]): void { updateMeta('tags', newTags); }
const visibility = computed(() => (props.metadata.visibility as string) || 'public');
function onVisibilityUpdate(val: string): void { updateMeta('visibility', val); }

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
  return '720px';
});

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
</script>

<template>
  <div class="cpub-ee-shell">
    <!-- Mobile sidebar toggles -->
    <div class="cpub-ee-mobile-toggles">
      <button class="cpub-ee-mobile-btn" aria-label="Toggle modules panel" @click="toggleMobileLeft"><i class="fa-solid fa-layer-group"></i></button>
      <button class="cpub-ee-mobile-btn" aria-label="Toggle properties panel" @click="toggleMobileRight"><i class="fa-solid fa-sliders"></i></button>
    </div>
    <div v-if="mobileLeftOpen || mobileRightOpen" class="cpub-ee-mobile-overlay" @click="closeMobileSidebars" />

    <!-- LEFT: Modules/Structure/Assets -->
    <aside class="cpub-ee-left" :class="{ 'cpub-ee-sidebar-open': mobileLeftOpen }" aria-label="Editor sidebar">
      <div class="cpub-ee-left-tabs">
        <button class="cpub-ee-left-tab" :class="{ active: activeLeftTab === 'modules' }" @click="activeLeftTab = 'modules'">Modules</button>
        <button class="cpub-ee-left-tab" :class="{ active: activeLeftTab === 'structure' }" @click="activeLeftTab = 'structure'">Structure</button>
        <button class="cpub-ee-left-tab" :class="{ active: activeLeftTab === 'assets' }" @click="activeLeftTab = 'assets'">Assets</button>
      </div>

      <div v-if="activeLeftTab === 'modules'" class="cpub-ee-left-body">
        <EditorsEditorBlocks :groups="blockTypes" :block-editor="blockEditor" />
      </div>

      <div v-else-if="activeLeftTab === 'structure'" class="cpub-ee-left-body" style="padding: 10px;">
        <!-- Flow guidance -->
        <div class="cpub-ee-flow-guide">
          <div class="cpub-ee-flow-title"><i class="fa-solid fa-route"></i> Section Flow</div>
          <div class="cpub-ee-flow-steps">
            <span class="cpub-ee-flow-step">Question</span>
            <i class="fa-solid fa-arrow-right cpub-ee-flow-arrow"></i>
            <span class="cpub-ee-flow-step cpub-ee-flow-step--interactive">Interact</span>
            <i class="fa-solid fa-arrow-right cpub-ee-flow-arrow"></i>
            <span class="cpub-ee-flow-step">Insight</span>
            <i class="fa-solid fa-arrow-right cpub-ee-flow-arrow"></i>
            <span class="cpub-ee-flow-step">Bridge</span>
          </div>
        </div>

        <!-- Interactive count summary -->
        <div class="cpub-ee-interactive-summary">
          <span class="cpub-ee-interactive-count">{{ totalInteractives }}</span>
          <span>interactive{{ totalInteractives === 1 ? '' : 's' }} across {{ structureSections.length }} section{{ structureSections.length === 1 ? '' : 's' }}</span>
        </div>

        <!-- Section list -->
        <div v-if="structureSections.length > 0" class="cpub-ee-section-list">
          <div
            v-for="section in structureSections"
            :key="section.id"
            class="cpub-ee-section-item"
            @click="blockEditor.selectBlock(section.id)"
          >
            <span class="cpub-ee-section-num">{{ String(section.index).padStart(2, '0') }}</span>
            <div class="cpub-ee-section-info">
              <span class="cpub-ee-section-title">{{ section.title }}</span>
              <span class="cpub-ee-section-meta">
                {{ section.blockCount }} blocks
                <template v-if="section.interactiveCount > 0">
                  <span class="cpub-ee-section-interactive-badge">
                    <i class="fa-solid fa-bolt"></i> {{ section.interactiveCount }}
                  </span>
                </template>
                <template v-else>
                  <span class="cpub-ee-section-no-interactive">no interactive</span>
                </template>
              </span>
            </div>
          </div>
        </div>

        <div v-else class="cpub-ee-structure-empty">
          <i class="fa-solid fa-layer-group"></i>
          <p>Add Section Header blocks to create sections.</p>
          <p>Each section should follow:<br /><strong>Question &rarr; Interactive &rarr; Insight</strong></p>
        </div>
      </div>

      <div v-else class="cpub-ee-left-body">
        <label class="cpub-ee-assets-drop">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <div class="cpub-ee-assets-drop-label">Drop files here</div>
          <div class="cpub-ee-assets-drop-sub">JPG, PNG, GIF, SVG, PDF</div>
          <input type="file" class="cpub-sr-only" @change="onAssetUpload">
        </label>
        <div v-if="uploadedFiles.length > 0" class="cpub-ee-assets-list">
          <div class="cpub-ee-assets-heading">Recent Uploads</div>
          <div
            v-for="(file, idx) in uploadedFiles"
            :key="idx"
            class="cpub-ee-asset-item"
          >
            <div class="cpub-ee-asset-icon">
              <i :class="file.type === 'image' ? 'fa-solid fa-image' : 'fa-solid fa-file'" />
            </div>
            <div class="cpub-ee-asset-info">
              <div class="cpub-ee-asset-name">{{ file.name }}</div>
              <div class="cpub-ee-asset-size">{{ file.size }}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- CENTER: Canvas with toolbar -->
    <div class="cpub-ee-center">
      <!-- Canvas toolbar -->
      <div class="cpub-ee-canvas-toolbar">
        <div class="cpub-ee-viewport-tabs">
          <button class="cpub-ee-viewport-tab" :class="{ active: viewportMode === 'desktop' }" title="Desktop" @click="viewportMode = 'desktop'"><i class="fa-solid fa-desktop"></i></button>
          <button class="cpub-ee-viewport-tab" :class="{ active: viewportMode === 'tablet' }" title="Tablet" @click="viewportMode = 'tablet'"><i class="fa-solid fa-tablet-screen-button"></i></button>
          <button class="cpub-ee-viewport-tab" :class="{ active: viewportMode === 'mobile' }" title="Mobile" @click="viewportMode = 'mobile'"><i class="fa-solid fa-mobile-screen"></i></button>
        </div>
      </div>

      <div class="cpub-ee-canvas">
        <div class="cpub-ee-canvas-inner" :style="{ maxWidth: canvasMaxWidth }">
          <EditorsBlockCanvas :block-editor="blockEditor" :block-types="blockTypes" />
        </div>
      </div>

      <!-- Status bar -->
      <div class="cpub-ee-statusbar">
        <div class="cpub-ee-status-item"><i class="fa-solid fa-layer-group"></i> <span>{{ structureSections.length }} sections</span></div>
        <div class="cpub-ee-status-sep" />
        <div class="cpub-ee-status-item"><i class="fa-solid fa-bolt"></i> <span>{{ totalInteractives }} interactives</span></div>
        <div class="cpub-ee-status-sep" />
        <div class="cpub-ee-status-item"><i class="fa-solid fa-align-justify"></i> <span>{{ wordCount.toLocaleString() }} words</span></div>
        <div class="cpub-ee-status-sep" />
        <div class="cpub-ee-status-item"><i class="fa-regular fa-clock"></i> <span>~{{ readTime }} min</span></div>
      </div>
    </div>

    <!-- RIGHT: Properties -->
    <aside class="cpub-ee-right" :class="{ 'cpub-ee-sidebar-open': mobileRightOpen }" aria-label="Explainer properties">
      <div class="cpub-ee-right-body">
        <EditorsEditorSection title="Content" icon="fa-sliders" :open="openSections.section" @toggle="toggleSection('section')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Slug</label>
            <input class="cpub-ep-input" type="text" :value="metadata.slug" placeholder="auto-generated" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Description</label>
            <textarea class="cpub-ep-textarea" rows="3" :value="metadata.description as string" placeholder="What does this explainer teach?" @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Estimated Minutes</label>
            <input class="cpub-ep-input" type="number" :value="metadata.estimatedMinutes" placeholder="10" @input="updateMeta('estimatedMinutes', Number(($event.target as HTMLInputElement).value))">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Tags</label>
            <EditorsEditorTagInput :tags="tags" @update:tags="onTagsUpdate" />
          </div>
        </EditorsEditorSection>

        <EditorsEditorSection title="Difficulty" icon="fa-gauge-high" :open="openSections.difficulty" @toggle="toggleSection('difficulty')">
          <select class="cpub-ep-select" :value="metadata.difficulty || 'beginner'" @change="updateMeta('difficulty', ($event.target as HTMLSelectElement).value)">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </EditorsEditorSection>

        <EditorsEditorSection title="Visibility" icon="fa-eye" :open="openSections.visibility" @toggle="toggleSection('visibility')">
          <EditorsEditorVisibility :model-value="visibility" @update:model-value="onVisibilityUpdate" />
        </EditorsEditorSection>

        <EditorsEditorSection title="Cover Image" icon="fa-image" :open="openSections.cover" @toggle="toggleSection('cover')">
          <div class="cpub-ep-field">
            <input class="cpub-ep-input" type="url" :value="metadata.coverImageUrl" placeholder="https://..." @input="updateMeta('coverImageUrl', ($event.target as HTMLInputElement).value)">
          </div>
        </EditorsEditorSection>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.cpub-ee-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-ee-left { width: 240px; flex-shrink: 0; background: var(--surface); border-right: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-left-tabs { display: flex; border-bottom: var(--border-width-default) solid var(--border); flex-shrink: 0; }
.cpub-ee-left-tab {
  flex: 1; padding: 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase; text-align: center;
  background: none; border: none; color: var(--text-dim); cursor: pointer;
  border-bottom: var(--border-width-default) solid transparent; margin-bottom: -2px;
}
.cpub-ee-left-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--accent-bg); }
.cpub-ee-left-body { flex: 1; overflow-y: auto; }

/* Flow guide */
.cpub-ee-flow-guide {
  background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); padding: 10px 12px; margin-bottom: 8px;
}
.cpub-ee-flow-title { font-family: var(--font-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.cpub-ee-flow-steps { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.cpub-ee-flow-step { font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); padding: 2px 6px; background: var(--surface); border: var(--border-width-default) solid var(--border2); }
.cpub-ee-flow-step--interactive { color: var(--accent); border-color: var(--accent-border); font-weight: 600; }
.cpub-ee-flow-arrow { font-size: 7px; color: var(--text-faint); }

/* Interactive summary */
.cpub-ee-interactive-summary {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px; margin-bottom: 8px;
  font-size: 10px; font-family: var(--font-mono); color: var(--text-dim);
}
.cpub-ee-interactive-count { font-size: 16px; font-weight: 700; color: var(--accent); }

/* Section list */
.cpub-ee-section-list { display: flex; flex-direction: column; gap: 2px; }
.cpub-ee-section-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px; cursor: pointer; border: var(--border-width-default) solid transparent; transition: all 0.1s; }
.cpub-ee-section-item:hover { background: var(--surface2); border-color: var(--border2); }
.cpub-ee-section-num { font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--text-faint); min-width: 18px; margin-top: 1px; }
.cpub-ee-section-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cpub-ee-section-title { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-ee-section-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 6px; }
.cpub-ee-section-interactive-badge { display: inline-flex; align-items: center; gap: 3px; color: var(--accent); font-weight: 600; }
.cpub-ee-section-no-interactive { color: var(--yellow); font-style: italic; }

/* Empty state */
.cpub-ee-structure-empty {
  text-align: center; padding: 20px 12px; color: var(--text-dim);
}
.cpub-ee-structure-empty i { font-size: 20px; color: var(--text-faint); margin-bottom: 8px; }
.cpub-ee-structure-empty p { font-size: 11px; line-height: 1.6; margin: 0 0 6px; }
.cpub-ee-structure-empty strong { color: var(--accent); }

/* Assets */
.cpub-ee-assets-drop {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 20px 12px; margin: 8px; border: 2px dashed var(--border2); cursor: pointer;
  transition: border-color 0.15s, background 0.15s; text-align: center;
}
.cpub-ee-assets-drop:hover { border-color: var(--accent); background: var(--accent-bg); }
.cpub-ee-assets-drop i { font-size: 20px; color: var(--text-faint); }
.cpub-ee-assets-drop-label { font-size: 11px; font-weight: 600; color: var(--text-dim); }
.cpub-ee-assets-drop-sub { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-ee-assets-list { padding: 8px 12px; }
.cpub-ee-assets-heading { font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-faint); padding: 4px 0 10px; }
.cpub-ee-asset-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--surface); border: var(--border-width-default) solid var(--border); cursor: pointer;
  box-shadow: var(--shadow-sm); margin-bottom: 5px;
}
.cpub-ee-asset-icon { width: 34px; height: 34px; background: var(--surface2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: var(--border-width-default) solid var(--border2); }
.cpub-ee-asset-icon i { font-size: 11px; color: var(--text-faint); }
.cpub-ee-asset-info { flex: 1; min-width: 0; }
.cpub-ee-asset-name { font-size: 10px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.cpub-ee-asset-size { font-family: var(--font-mono); font-size: 8px; color: var(--text-faint); }

.cpub-ee-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-ee-canvas-inner { margin: 0 auto; transition: max-width 0.2s; }

/* Canvas toolbar */
.cpub-ee-canvas-toolbar {
  display: flex; align-items: center; gap: 2px; padding: 4px 12px;
  background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); flex-shrink: 0; min-height: 32px;
  justify-content: flex-end;
}
.cpub-ee-viewport-tabs { display: flex; gap: 0; }
.cpub-ee-viewport-tab {
  width: 28px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: none; border: var(--border-width-default) solid var(--border); border-left-width: 0; color: var(--text-faint);
  font-size: 10px; cursor: pointer;
}
.cpub-ee-viewport-tab:first-child { border-left-width: 2px; }
.cpub-ee-viewport-tab.active { background: var(--border); color: var(--color-text-inverse); }
.cpub-ee-viewport-tab:hover:not(.active) { background: var(--surface2); color: var(--text-dim); }

/* Status bar */
.cpub-ee-statusbar {
  height: 26px; background: var(--surface); border-top: var(--border-width-default) solid var(--border);
  display: flex; align-items: center; padding: 0 14px; gap: 18px; flex-shrink: 0;
}
.cpub-ee-status-item {
  display: flex; align-items: center; gap: 5px; font-family: var(--font-mono);
  font-size: 9px; color: var(--text-faint); white-space: nowrap;
}
.cpub-ee-status-item i { font-size: 8px; }
.cpub-ee-status-sep { width: 2px; height: 12px; background: var(--border); }
.cpub-ee-right { width: 280px; flex-shrink: 0; background: var(--surface); border-left: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-right-body { flex: 1; overflow-y: auto; }

.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

/* Mobile sidebar toggles */
.cpub-ee-mobile-toggles { display: none; }
.cpub-ee-mobile-overlay { display: none; }

@media (max-width: 1024px) {
  .cpub-ee-left {
    position: fixed; top: 0; bottom: 0; left: 0; z-index: 200;
    transform: translateX(-100%); transition: transform 0.2s ease;
  }
  .cpub-ee-left.cpub-ee-sidebar-open { transform: translateX(0); }

  .cpub-ee-right {
    position: fixed; top: 0; bottom: 0; right: 0; z-index: 200;
    transform: translateX(100%); transition: transform 0.2s ease;
  }
  .cpub-ee-right.cpub-ee-sidebar-open { transform: translateX(0); }

  .cpub-ee-mobile-toggles {
    display: flex; position: fixed; bottom: 16px; right: 16px;
    gap: 8px; z-index: 100;
  }
  .cpub-ee-mobile-btn {
    width: 44px; height: 44px; border: var(--border-width-default) solid var(--border); background: var(--surface);
    color: var(--text-dim); font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow-md);
  }
  .cpub-ee-mobile-btn:hover { background: var(--surface2); color: var(--text); }
  .cpub-ee-mobile-overlay {
    display: block; position: fixed; inset: 0;
    background: var(--color-surface-overlay-light); z-index: 199;
  }
}
</style>
