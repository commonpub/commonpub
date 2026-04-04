<script setup lang="ts">
/**
 * ExplainerEditor — standalone 3-panel editor.
 * No Nuxt dependencies. Works in any Vue 3 app.
 */
import { ref, computed } from 'vue';
import type { BlockEditor } from '../composables/useBlockEditor.js';
import type { BlockTypeGroup } from './editor/EditorBlockLibrary.vue';
import EditorBlockLibrary from './editor/EditorBlockLibrary.vue';
import EditorSection from './editor/EditorSection.vue';
import EditorTagInput from './editor/EditorTagInput.vue';
import BlockCanvas from './editor/BlockCanvas.vue';

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

const activeLeftTab = ref<'modules' | 'structure'>('modules');

const blockTypes: BlockTypeGroup[] = [
  {
    name: 'Interactive',
    blocks: [
      { type: 'interactiveSlider', label: 'Range Slider', description: 'Slider with feedback ranges' },
      { type: 'quiz', label: 'Knowledge Check', description: 'Quiz with answer feedback' },
      { type: 'checkpoint', label: 'Checkpoint', description: 'Section completion marker' },
      { type: 'callout', label: 'Key Insight', description: 'Highlight discovery moments', attrs: { variant: 'tip' } },
    ],
  },
  {
    name: 'Content',
    blocks: [
      { type: 'paragraph', label: 'Body Text', description: '2-3 short paragraphs max' },
      { type: 'heading', label: 'Heading', description: 'In-section heading (H2/H3)' },
      { type: 'image', label: 'Diagram', description: 'Visual explanation' },
      { type: 'code_block', label: 'Code Example', description: 'Runnable code snippet' },
    ],
  },
  {
    name: 'Data & Viz',
    blocks: [
      { type: 'embed', label: 'Embed', description: 'External interactive' },
      { type: 'callout', label: 'Warning', description: 'Important caveat', attrs: { variant: 'warning' } },
    ],
  },
  {
    name: 'Structure',
    blocks: [
      { type: 'sectionHeader', label: 'Section Header', description: 'Tag + title + intro — starts a section' },
      { type: 'horizontal_rule', label: 'Divider', description: 'Visual break' },
    ],
  },
];

const INTERACTIVE_TYPES = new Set(['interactiveSlider', 'slider', 'quiz', 'checkpoint']);

interface StructureSection { id: string; title: string; blockCount: number; interactiveCount: number; index: number; }

const structureSections = computed<StructureSection[]>(() => {
  const result: StructureSection[] = [];
  const blocks = props.blockEditor.blocks.value;
  let current: StructureSection | null = null;
  let idx = 0;
  const hasSectionHeaders = blocks.some(b => b.type === 'sectionHeader');
  const sectionType = hasSectionHeaders ? 'sectionHeader' : 'heading';

  for (const block of blocks) {
    const isSectionStart = sectionType === 'sectionHeader'
      ? block.type === 'sectionHeader'
      : block.type === 'heading' && ((block.content.level as number) ?? 2) <= 2;
    if (isSectionStart) {
      if (current) result.push(current);
      idx++;
      const title = sectionType === 'sectionHeader' ? (block.content.title as string) || 'Untitled' : (block.content.text as string) || 'Untitled';
      current = { id: block.id, title, blockCount: 1, interactiveCount: 0, index: idx };
    } else if (current) {
      current.blockCount++;
      if (INTERACTIVE_TYPES.has(block.type)) current.interactiveCount++;
    }
  }
  if (current) result.push(current);
  return result;
});

const totalInteractives = computed(() => props.blockEditor.blocks.value.filter(b => INTERACTIVE_TYPES.has(b.type)).length);

const openSections = ref<Record<string, boolean>>({ section: true, difficulty: true, visibility: false, cover: false });
function toggleSection(key: string): void { openSections.value[key] = !openSections.value[key]; }

const tags = computed(() => (props.metadata.tags as string[]) || []);
function onTagsUpdate(newTags: string[]): void { updateMeta('tags', newTags); }

// Word count / status bar
const wordCount = computed(() => {
  let count = 0;
  for (const block of props.blockEditor.blocks.value) {
    const html = (block.content.html as string) || '';
    const text = (block.content.text as string) || '';
    const code = (block.content.code as string) || '';
    const combined = html.replace(/<[^>]*>/g, ' ') + ' ' + text + ' ' + code;
    count += combined.split(/\s+/).filter(w => w.length > 0).length;
  }
  return count;
});
const readTime = computed(() => Math.max(1, Math.round(wordCount.value / 200)));
</script>

<template>
  <div class="cpub-ee-shell">
    <!-- LEFT: Modules/Structure -->
    <aside class="cpub-ee-left" aria-label="Editor sidebar">
      <div class="cpub-ee-left-tabs">
        <button class="cpub-ee-left-tab" :class="{ active: activeLeftTab === 'modules' }" @click="activeLeftTab = 'modules'">Modules</button>
        <button class="cpub-ee-left-tab" :class="{ active: activeLeftTab === 'structure' }" @click="activeLeftTab = 'structure'">Structure</button>
      </div>

      <div v-if="activeLeftTab === 'modules'" class="cpub-ee-left-body">
        <EditorBlockLibrary :groups="blockTypes" :block-editor="blockEditor" />
      </div>

      <div v-else class="cpub-ee-left-body" style="padding: 10px;">
        <div class="cpub-ee-flow-guide">
          <div class="cpub-ee-flow-title">Section Flow</div>
          <div class="cpub-ee-flow-steps">
            <span class="cpub-ee-flow-step">Question</span>
            <span class="cpub-ee-flow-arrow">&rarr;</span>
            <span class="cpub-ee-flow-step cpub-ee-flow-step--interactive">Interact</span>
            <span class="cpub-ee-flow-arrow">&rarr;</span>
            <span class="cpub-ee-flow-step">Insight</span>
            <span class="cpub-ee-flow-arrow">&rarr;</span>
            <span class="cpub-ee-flow-step">Bridge</span>
          </div>
        </div>

        <div class="cpub-ee-interactive-summary">
          <span class="cpub-ee-interactive-count">{{ totalInteractives }}</span>
          <span>interactive{{ totalInteractives === 1 ? '' : 's' }} across {{ structureSections.length }} section{{ structureSections.length === 1 ? '' : 's' }}</span>
        </div>

        <div v-if="structureSections.length > 0" class="cpub-ee-section-list">
          <div v-for="section in structureSections" :key="section.id" class="cpub-ee-section-item" @click="blockEditor.selectBlock(section.id)">
            <span class="cpub-ee-section-num">{{ String(section.index).padStart(2, '0') }}</span>
            <div class="cpub-ee-section-info">
              <span class="cpub-ee-section-title">{{ section.title }}</span>
              <span class="cpub-ee-section-meta">{{ section.blockCount }} blocks <template v-if="section.interactiveCount > 0"><span class="cpub-ee-section-interactive-badge">&#9889; {{ section.interactiveCount }}</span></template></span>
            </div>
          </div>
        </div>
        <div v-else class="cpub-ee-structure-empty">
          <p>Add Section Header blocks to create sections.</p>
        </div>
      </div>
    </aside>

    <!-- CENTER: Canvas -->
    <div class="cpub-ee-center">
      <div class="cpub-ee-canvas">
        <BlockCanvas :block-editor="blockEditor" />
      </div>
      <div class="cpub-ee-statusbar">
        <div class="cpub-ee-status-item">{{ structureSections.length }} sections</div>
        <div class="cpub-ee-status-sep" />
        <div class="cpub-ee-status-item">{{ totalInteractives }} interactives</div>
        <div class="cpub-ee-status-sep" />
        <div class="cpub-ee-status-item">{{ wordCount.toLocaleString() }} words</div>
        <div class="cpub-ee-status-sep" />
        <div class="cpub-ee-status-item">~{{ readTime }} min</div>
      </div>
    </div>

    <!-- RIGHT: Properties -->
    <aside class="cpub-ee-right" aria-label="Explainer properties">
      <div class="cpub-ee-right-body">
        <EditorSection title="Content" :open="openSections.section" @toggle="toggleSection('section')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Slug</label>
            <input class="cpub-ep-input" type="text" :value="metadata.slug" placeholder="auto-generated" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)" />
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Description</label>
            <textarea class="cpub-ep-textarea" rows="3" :value="(metadata.description as string)" placeholder="What does this explainer teach?" @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Estimated Minutes</label>
            <input class="cpub-ep-input" type="number" :value="metadata.estimatedMinutes" placeholder="10" @input="updateMeta('estimatedMinutes', Number(($event.target as HTMLInputElement).value))" />
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Tags</label>
            <EditorTagInput :tags="tags" @update:tags="onTagsUpdate" />
          </div>
        </EditorSection>

        <EditorSection title="Difficulty" :open="openSections.difficulty" @toggle="toggleSection('difficulty')">
          <select class="cpub-ep-select" :value="metadata.difficulty || 'beginner'" @change="updateMeta('difficulty', ($event.target as HTMLSelectElement).value)">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </EditorSection>

        <EditorSection title="Cover Image" :open="openSections.cover" @toggle="toggleSection('cover')">
          <div class="cpub-ep-field">
            <input class="cpub-ep-input" type="url" :value="metadata.coverImageUrl" placeholder="https://..." @input="updateMeta('coverImageUrl', ($event.target as HTMLInputElement).value)" />
          </div>
        </EditorSection>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.cpub-ee-shell { display: flex; flex: 1; overflow: hidden; height: 100%; }
.cpub-ee-left { width: 240px; flex-shrink: 0; background: var(--surface); border-right: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-left-tabs { display: flex; border-bottom: var(--border-width-default) solid var(--border); flex-shrink: 0; }
.cpub-ee-left-tab { flex: 1; padding: 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; text-align: center; background: none; border: none; color: var(--text-dim); cursor: pointer; border-bottom: var(--border-width-default) solid transparent; margin-bottom: -2px; }
.cpub-ee-left-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--accent-bg); }
.cpub-ee-left-body { flex: 1; overflow-y: auto; }

.cpub-ee-flow-guide { background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); padding: 10px 12px; margin-bottom: 8px; }
.cpub-ee-flow-title { font-family: var(--font-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
.cpub-ee-flow-steps { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.cpub-ee-flow-step { font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); padding: 2px 6px; background: var(--surface); border: var(--border-width-default) solid var(--border2); }
.cpub-ee-flow-step--interactive { color: var(--accent); border-color: var(--accent-border); font-weight: 600; }
.cpub-ee-flow-arrow { font-size: 7px; color: var(--text-faint); }
.cpub-ee-interactive-summary { display: flex; align-items: center; gap: 6px; padding: 6px 8px; margin-bottom: 8px; font-size: 10px; font-family: var(--font-mono); color: var(--text-dim); }
.cpub-ee-interactive-count { font-size: 16px; font-weight: 700; color: var(--accent); }
.cpub-ee-section-list { display: flex; flex-direction: column; gap: 2px; }
.cpub-ee-section-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px; cursor: pointer; border: var(--border-width-default) solid transparent; transition: all 0.1s; }
.cpub-ee-section-item:hover { background: var(--surface2); border-color: var(--border2); }
.cpub-ee-section-num { font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--text-faint); min-width: 18px; margin-top: 1px; }
.cpub-ee-section-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cpub-ee-section-title { font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cpub-ee-section-meta { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); display: flex; align-items: center; gap: 6px; }
.cpub-ee-section-interactive-badge { display: inline-flex; align-items: center; gap: 3px; color: var(--accent); font-weight: 600; }
.cpub-ee-structure-empty { text-align: center; padding: 20px 12px; color: var(--text-dim); font-size: 11px; }

.cpub-ee-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-ee-statusbar { height: 26px; background: var(--surface); border-top: var(--border-width-default) solid var(--border); display: flex; align-items: center; padding: 0 14px; gap: 18px; flex-shrink: 0; }
.cpub-ee-status-item { display: flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); white-space: nowrap; }
.cpub-ee-status-sep { width: 2px; height: 12px; background: var(--border); }
.cpub-ee-right { width: 280px; flex-shrink: 0; background: var(--surface); border-left: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ee-right-body { flex: 1; overflow-y: auto; }

/* Property fields */
.cpub-ep-field { margin-bottom: 10px; }
.cpub-ep-flabel { display: block; font-family: var(--font-mono); font-size: 10px; font-weight: 600; color: var(--text-faint); letter-spacing: 0.04em; margin-bottom: 4px; }
.cpub-ep-input { width: 100%; padding: 6px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface); font-size: 12px; color: var(--text); outline: none; }
.cpub-ep-input:focus { border-color: var(--accent); }
.cpub-ep-textarea { width: 100%; padding: 6px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface); font-size: 12px; color: var(--text); outline: none; resize: vertical; font-family: inherit; }
.cpub-ep-textarea:focus { border-color: var(--accent); }
.cpub-ep-select { width: 100%; padding: 6px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface); font-size: 12px; color: var(--text); cursor: pointer; }
</style>
