<script setup lang="ts">
import type { BlockTuple } from '@commonpub/editor';
import type { Editor } from '@tiptap/core';

const props = defineProps<{
  blocks: BlockTuple[];
  metadata: Record<string, unknown>;
  editorRef: { editor: Editor } | null;
}>();

const emit = defineEmits<{
  'update:metadata': [metadata: Record<string, unknown>];
}>();

function updateMeta(key: string, value: unknown): void {
  emit('update:metadata', { ...props.metadata, [key]: value });
}

// --- Left: block library with explainer-specific blocks ---
const blockSearch = ref('');
const activeLeftTab = ref<'modules' | 'structure'>('modules');

const libGroups = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Paragraph', icon: 'fa-align-left' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading' },
      { type: 'image', label: 'Image', icon: 'fa-image' },
      { type: 'code_block', label: 'Code Block', icon: 'fa-code' },
    ],
  },
  {
    name: 'Interactive',
    blocks: [
      { type: 'interactiveSlider', label: 'Range Slider', icon: 'fa-sliders' },
      { type: 'quiz', label: 'Quiz', icon: 'fa-circle-question' },
      { type: 'checkpoint', label: 'Checkpoint', icon: 'fa-flag-checkered' },
    ],
  },
  {
    name: 'Data',
    blocks: [
      { type: 'mathNotation', label: 'Math Block', icon: 'fa-square-root-variable' },
      { type: 'callout', label: 'Callout', icon: 'fa-circle-exclamation' },
      { type: 'embed', label: 'Embed', icon: 'fa-globe' },
    ],
  },
];

const filteredGroups = computed(() => {
  const q = blockSearch.value.toLowerCase();
  if (!q) return libGroups;
  return libGroups
    .map(g => ({ ...g, blocks: g.blocks.filter(b => b.label.toLowerCase().includes(q)) }))
    .filter(g => g.blocks.length > 0);
});

function insertBlock(type: string): void {
  const editor = props.editorRef?.editor;
  if (!editor) return;
  // Use a single chained transaction to avoid mismatched state between focus + insert
  switch (type) {
    case 'paragraph': editor.chain().focus('end').insertContent({ type: 'paragraph' }).run(); break;
    case 'heading': editor.chain().focus('end').insertContent({ type: 'heading', attrs: { level: 2 } }).run(); break;
    case 'image': editor.chain().focus('end').setImage({ src: '', alt: '' }).run(); break;
    case 'code_block': editor.chain().focus('end').setCodeBlock().run(); break;
    case 'interactiveSlider': editor.chain().focus('end').insertContent({ type: 'interactiveSlider', attrs: { label: '', min: 0, max: 100, step: 1, defaultValue: 50, states: [] } }).run(); break;
    case 'quiz': editor.chain().focus('end').insertContent({ type: 'quiz', attrs: { question: '', options: [] } }).run(); break;
    case 'checkpoint': editor.chain().focus('end').insertContent({ type: 'checkpoint', attrs: { message: '' } }).run(); break;
    case 'mathNotation': editor.chain().focus('end').insertContent({ type: 'mathNotation', attrs: { expression: '' } }).run(); break;
    case 'callout': editor.chain().focus('end').insertContent({ type: 'callout', attrs: { variant: 'info' } }).run(); break;
    case 'embed': editor.chain().focus('end').insertContent({ type: 'embed', attrs: { url: '', type: 'generic' } }).run(); break;
  }
}

// --- Right: properties ---
const openSections = ref<Record<string, boolean>>({
  section: true, difficulty: true, visibility: false, cover: false,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

const difficultyOptions = [
  { value: 1, label: 'Beginner' },
  { value: 2, label: 'Intermediate' },
  { value: 3, label: 'Advanced' },
];

const tagInput = ref('');
function addTag(e: KeyboardEvent): void {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = tagInput.value.trim().replace(/,$/, '');
    const existing = (props.metadata.tags as string[]) || [];
    if (val && !existing.includes(val)) {
      updateMeta('tags', [...existing, val]);
    }
    tagInput.value = '';
  }
}
function removeTag(idx: number): void {
  const existing = (props.metadata.tags as string[]) || [];
  updateMeta('tags', existing.filter((_: string, i: number) => i !== idx));
}
</script>

<template>
  <div class="cpub-ee-shell">
    <!-- LEFT: Modules/Structure -->
    <aside class="cpub-ee-left" aria-label="Block library">
      <div class="cpub-ee-left-tabs">
        <button class="cpub-ee-left-tab" :class="{ active: activeLeftTab === 'modules' }" @click="activeLeftTab = 'modules'">Modules</button>
        <button class="cpub-ee-left-tab" :class="{ active: activeLeftTab === 'structure' }" @click="activeLeftTab = 'structure'">Structure</button>
      </div>

      <template v-if="activeLeftTab === 'modules'">
        <div class="cpub-ep-lib-header">
          <div class="cpub-ep-search">
            <i class="fa fa-search"></i>
            <input v-model="blockSearch" type="text" placeholder="Search blocks...">
          </div>
        </div>
        <div class="cpub-ep-lib-body">
          <div v-for="group in filteredGroups" :key="group.name" class="cpub-ep-group">
            <div class="cpub-ep-group-label">{{ group.name }}</div>
            <button
              v-for="block in group.blocks"
              :key="block.type"
              class="cpub-ep-block-item"
              :aria-label="`Insert ${block.label}`"
              @click="insertBlock(block.type)"
            >
              <span class="cpub-ep-block-icon"><i class="fa" :class="block.icon"></i></span>
              <span>{{ block.label }}</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="cpub-ep-lib-body" style="padding: 12px;">
          <p class="cpub-ee-structure-hint">Sections are defined by H2 headings in your content. Add headings to create the explainer structure.</p>
        </div>
      </template>
    </aside>

    <!-- CENTER: Canvas -->
    <div class="cpub-ee-canvas">
      <div class="cpub-ee-canvas-inner">
        <slot />
      </div>
    </div>

    <!-- RIGHT: Properties -->
    <aside class="cpub-ee-right" aria-label="Explainer properties">
      <div class="cpub-ee-right-body">
        <!-- Section / Content -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.section }">
          <button class="cpub-ep-section-header" @click="toggleSection('section')">
            <i class="fa fa-sliders cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Content</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Slug</label>
              <input class="cpub-ep-input" type="text" :value="metadata.slug" placeholder="auto-generated" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)">
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Description</label>
              <textarea class="cpub-ep-textarea" rows="3" :value="metadata.description as string" placeholder="What does this explainer teach?" @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Learning Objectives</label>
              <textarea class="cpub-ep-textarea" rows="3" :value="metadata.learningObjectives as string" placeholder="One per line..." @input="updateMeta('learningObjectives', ($event.target as HTMLTextAreaElement).value)" />
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Estimated Minutes</label>
              <input class="cpub-ep-input" type="number" :value="metadata.estimatedMinutes" placeholder="10" @input="updateMeta('estimatedMinutes', Number(($event.target as HTMLInputElement).value))">
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Tags</label>
              <div class="cpub-ep-chip-wrap">
                <span v-for="(tag, i) in ((metadata.tags as string[]) || [])" :key="tag" class="cpub-ep-chip">
                  {{ tag }} <span class="cpub-ep-chip-x" @click="removeTag(i)">&times;</span>
                </span>
                <input v-model="tagInput" class="cpub-ep-chip-input" type="text" placeholder="Add tag..." @keydown="addTag">
              </div>
            </div>
          </div>
        </div>

        <!-- Difficulty -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.difficulty }">
          <button class="cpub-ep-section-header" @click="toggleSection('difficulty')">
            <i class="fa fa-gauge-high cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Difficulty</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <select class="cpub-ep-select" :value="metadata.difficulty || 1" @change="updateMeta('difficulty', Number(($event.target as HTMLSelectElement).value))">
                <option v-for="opt in difficultyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Visibility -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.visibility }">
          <button class="cpub-ep-section-header" @click="toggleSection('visibility')">
            <i class="fa fa-eye cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Visibility</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <select class="cpub-ep-select" :value="metadata.visibility || 'public'" @change="updateMeta('visibility', ($event.target as HTMLSelectElement).value)">
                <option value="public">Public</option>
                <option value="members">Members only</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Cover -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.cover }">
          <button class="cpub-ep-section-header" @click="toggleSection('cover')">
            <i class="fa fa-image cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Cover Image</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <input class="cpub-ep-input" type="url" :value="metadata.coverImage" placeholder="https://..." @input="updateMeta('coverImage', ($event.target as HTMLInputElement).value)">
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
/* Layout only — shared form/section/chip/library styles in editor-panels.css */
.cpub-ee-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-ee-left { width: 240px; flex-shrink: 0; background: var(--surface); border-right: 2px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-left-tabs { display: flex; border-bottom: 2px solid var(--border); }
.cpub-ee-left-tab { flex: 1; padding: 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; text-align: center; background: none; border: none; color: var(--text-dim); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.cpub-ee-left-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--accent-bg); }
.cpub-ee-structure-hint { font-size: 11px; color: var(--text-dim); line-height: 1.5; }
.cpub-ee-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-ee-canvas-inner { max-width: 720px; margin: 0 auto; padding: 28px 32px 80px; }
.cpub-ee-right { width: 280px; flex-shrink: 0; background: var(--surface); border-left: 2px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-right-body { flex: 1; overflow-y: auto; }

@media (max-width: 1024px) { .cpub-ee-left, .cpub-ee-right { display: none; } }
</style>
