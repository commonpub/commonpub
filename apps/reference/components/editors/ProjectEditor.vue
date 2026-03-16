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

// --- Block library ---
const blockSearch = ref('');

const libGroups = [
  {
    label: 'Basic',
    variant: '',
    blocks: [
      { icon: 'fa-align-left', label: 'Text', type: 'paragraph' },
      { icon: 'fa-heading', label: 'Heading', type: 'heading' },
      { icon: 'fa-image', label: 'Image', type: 'image' },
      { icon: 'fa-images', label: 'Gallery', type: 'gallery' },
      { icon: 'fa-code', label: 'Code Block', type: 'codeBlock' },
      { icon: 'fa-film', label: 'Video Embed', type: 'video' },
    ],
  },
  {
    label: 'Project',
    variant: 'proj',
    blocks: [
      { icon: 'fa-list-check', label: 'Parts List', type: 'partsList' },
      { icon: 'fa-hammer', label: 'Build Step', type: 'buildStep' },
      { icon: 'fa-wrench', label: 'Tool List', type: 'toolList' },
      { icon: 'fa-download', label: 'Downloads', type: 'downloads' },
      { icon: 'fa-diagram-project', label: 'Wiring Diagram', type: 'wiringDiagram' },
      { icon: 'fa-wave-square', label: 'Schematic', type: 'schematic' },
    ],
  },
  {
    label: 'Tips',
    variant: 'tip',
    blocks: [
      { icon: 'fa-lightbulb', label: 'Tip', type: 'callout', attrs: { variant: 'tip' } },
      { icon: 'fa-triangle-exclamation', label: 'Warning', type: 'callout', attrs: { variant: 'warning' } },
      { icon: 'fa-circle-info', label: 'Note', type: 'callout', attrs: { variant: 'note' } },
      { icon: 'fa-bullhorn', label: 'Callout', type: 'callout', attrs: { variant: 'callout' } },
    ],
  },
  {
    label: 'Interactive',
    variant: 'inter',
    blocks: [
      { icon: 'fa-book-open', label: 'Explainer Section', type: 'explainerSection' },
      { icon: 'fa-terminal', label: 'Code Playground', type: 'codePlayground' },
      { icon: 'fa-circle-question', label: 'Quiz', type: 'quiz' },
    ],
  },
];

const filteredGroups = computed(() => {
  const q = blockSearch.value.toLowerCase();
  if (!q) return libGroups;
  return libGroups
    .map((g) => ({
      ...g,
      blocks: g.blocks.filter((b) => b.label.toLowerCase().includes(q)),
    }))
    .filter((g) => g.blocks.length > 0);
});

function insertBlock(block: { type: string; attrs?: Record<string, unknown> }): void {
  const editor = props.editorRef?.editor;
  if (!editor) return;

  const nodeType = block.type;
  const attrs = block.attrs || {};

  // Use a single chained transaction to avoid mismatched state between focus + insert
  if (nodeType === 'paragraph') {
    editor.chain().focus('end').insertContent({ type: 'paragraph', content: [{ type: 'text', text: '' }] }).run();
  } else if (nodeType === 'heading') {
    editor.chain().focus('end').insertContent({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '' }] }).run();
  } else if (nodeType === 'codeBlock') {
    editor.chain().focus('end').setCodeBlock({ language: 'cpp' }).run();
  } else if (nodeType === 'image') {
    editor.chain().focus('end').insertContent({ type: 'image', attrs: { src: '' } }).run();
  } else {
    editor.chain().focus('end').insertContent({ type: nodeType, attrs }).run();
  }
}

// --- Right panel sections ---
const openSections = ref<Record<string, boolean>>({
  meta: true, tags: true, community: false, visibility: true, cover: false, files: false, checklist: true,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

// Difficulty toggle
const difficulties = ['Beginner', 'Intermediate', 'Advanced'] as const;

// Tags
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

// Visibility options
const visOptions = [
  { value: 'public', label: 'Public', desc: 'Visible to everyone', icon: 'fa-globe' },
  { value: 'unlisted', label: 'Unlisted', desc: 'Anyone with link can view', icon: 'fa-link' },
  { value: 'private', label: 'Private', desc: 'Only you can see this', icon: 'fa-lock' },
];

// Checklist (computed from metadata)
const checklist = computed(() => [
  { label: 'Has cover image', pass: !!(props.metadata.coverImage) },
  { label: 'Has description', pass: !!((props.metadata.description as string)?.length) },
  { label: 'Has tags', pass: !!((props.metadata.tags as string[])?.length) },
  { label: 'Has difficulty set', pass: !!(props.metadata.difficulty) },
  { label: 'Has build time', pass: !!(props.metadata.buildTime) },
  { label: 'Has cost estimate', pass: !!(props.metadata.estimatedCost) },
]);
const checklistDone = computed(() => checklist.value.filter((c) => c.pass).length);
</script>

<template>
  <div class="cpub-pe-shell">
    <!-- LEFT: Block Library -->
    <aside class="cpub-pe-library" aria-label="Block library">
      <div class="cpub-ep-lib-header">
        <div class="cpub-ep-search">
          <i class="fa fa-search"></i>
          <input v-model="blockSearch" type="text" placeholder="Search blocks...">
        </div>
      </div>
      <div class="cpub-ep-lib-body">
        <div v-for="group in filteredGroups" :key="group.label" class="cpub-ep-group">
          <div class="cpub-ep-group-label">{{ group.label }}</div>
          <div class="cpub-pe-lib-blocks">
            <button
              v-for="block in group.blocks"
              :key="block.label"
              class="cpub-ep-block-item"
              :class="group.variant"
              @click="insertBlock(block)"
            >
              <span class="cpub-ep-block-icon">
                <i class="fa" :class="block.icon"></i>
              </span>
              <span class="cpub-pe-lib-block-label">{{ block.label }}</span>
              <i class="fa fa-grip-vertical cpub-pe-lib-block-drag"></i>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- CENTER: Editor Canvas -->
    <div class="cpub-pe-canvas">
      <div class="cpub-pe-canvas-inner">
        <slot />
      </div>
    </div>

    <!-- RIGHT: Settings Panel -->
    <aside class="cpub-pe-settings" aria-label="Project settings">
      <div class="cpub-pe-settings-body">

        <!-- Project Meta -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.meta }">
          <button class="cpub-ep-section-header" @click="toggleSection('meta')">
            <i class="fa fa-sliders cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Project Meta</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Slug</label>
              <input class="cpub-ep-input" type="text" :value="metadata.slug" placeholder="project-url-slug" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)">
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Category</label>
              <select class="cpub-ep-select" :value="metadata.category || 'Hardware'" @change="updateMeta('category', ($event.target as HTMLSelectElement).value)">
                <option value="Hardware">Hardware</option>
                <option value="Software">Software</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Difficulty</label>
              <div class="cpub-pe-toggle-group">
                <button
                  v-for="d in difficulties"
                  :key="d"
                  class="cpub-pe-toggle-opt"
                  :class="{ active: (metadata.difficulty || 'Intermediate') === d }"
                  @click="updateMeta('difficulty', d)"
                >{{ d }}</button>
              </div>
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Build Time</label>
              <input class="cpub-ep-input" type="text" :value="metadata.buildTime" placeholder="e.g. 2–4 hours" @input="updateMeta('buildTime', ($event.target as HTMLInputElement).value)">
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Cost Range</label>
              <div class="cpub-pe-row-2">
                <input class="cpub-ep-input" type="text" :value="metadata.costMin" placeholder="Min" @input="updateMeta('costMin', ($event.target as HTMLInputElement).value)">
                <input class="cpub-ep-input" type="text" :value="metadata.costMax" placeholder="Max" @input="updateMeta('costMax', ($event.target as HTMLInputElement).value)">
              </div>
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Description</label>
              <textarea class="cpub-ep-textarea" rows="3" :value="metadata.description as string" placeholder="Brief project description..." @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.tags }">
          <button class="cpub-ep-section-header" @click="toggleSection('tags')">
            <i class="fa fa-tag cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Tags</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-chip-wrap">
              <span v-for="(tag, i) in ((metadata.tags as string[]) || [])" :key="tag" class="cpub-ep-chip">
                {{ tag }} <span class="cpub-ep-chip-x" @click="removeTag(i)">&times;</span>
              </span>
              <input v-model="tagInput" class="cpub-ep-chip-input" type="text" placeholder="Add tag..." @keydown="addTag">
            </div>
            <span class="cpub-ep-hint">Press Enter or comma to add</span>
          </div>
        </div>

        <!-- Community -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.community }">
          <button class="cpub-ep-section-header" @click="toggleSection('community')">
            <i class="fa fa-layer-group cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Community</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Associate with Community</label>
              <select class="cpub-ep-select" :value="metadata.community || ''" @change="updateMeta('community', ($event.target as HTMLSelectElement).value)">
                <option value="">— None —</option>
              </select>
            </div>
            <span class="cpub-ep-hint">Project will appear in the community's project gallery.</span>
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
            <div class="cpub-ep-vis-group">
              <button
                v-for="opt in visOptions"
                :key="opt.value"
                class="cpub-ep-vis-opt"
                :class="{ selected: (metadata.visibility || 'public') === opt.value }"
                @click="updateMeta('visibility', opt.value)"
              >
                <span class="cpub-ep-vis-radio"><span class="cpub-ep-vis-dot"></span></span>
                <span class="cpub-ep-vis-info">
                  <span class="cpub-ep-vis-label">{{ opt.label }}</span>
                  <span class="cpub-ep-vis-desc">{{ opt.desc }}</span>
                </span>
                <i class="cpub-ep-vis-icon fa" :class="opt.icon"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Cover Image -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.cover }">
          <button class="cpub-ep-section-header" @click="toggleSection('cover')">
            <i class="fa fa-image cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Cover Image</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-pe-cover-upload-sm">
              <i class="fa fa-upload cpub-pe-cover-sm-icon"></i>
              <span class="cpub-pe-cover-sm-label">Upload cover image</span>
              <span class="cpub-pe-cover-sm-hint">16:5 · JPG, PNG, WebP · 8 MB max</span>
            </div>
            <div class="cpub-ep-field" style="margin-top: 6px;">
              <label class="cpub-ep-flabel">Or paste image URL</label>
              <input class="cpub-ep-input" type="url" :value="metadata.coverImage" placeholder="https://..." @input="updateMeta('coverImage', ($event.target as HTMLInputElement).value)">
            </div>
          </div>
        </div>

        <!-- Attached Files -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.files }">
          <button class="cpub-ep-section-header" @click="toggleSection('files')">
            <i class="fa fa-paperclip cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Attached Files</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <span class="cpub-ep-hint">File attachments coming soon.</span>
          </div>
        </div>

        <!-- Publishing Checklist -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.checklist }">
          <button class="cpub-ep-section-header" @click="toggleSection('checklist')">
            <i class="fa fa-circle-check cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Publishing Checklist</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-pe-checklist">
              <div v-for="item in checklist" :key="item.label" class="cpub-pe-check-item" :class="{ pass: item.pass, fail: !item.pass }">
                <i class="cpub-pe-check-icon" :class="item.pass ? 'fa-regular fa-square-check pass' : 'fa-regular fa-square fail'"></i>
                <span>{{ item.label }}</span>
              </div>
            </div>
            <div class="cpub-pe-checklist-summary">
              <span class="cpub-pe-checklist-count">{{ checklistDone }}/{{ checklist.length }} items complete</span>
              <span class="cpub-pe-checklist-hint">Complete remaining items to maximize discoverability.</span>
            </div>
          </div>
        </div>

      </div>
    </aside>
  </div>
</template>

<style scoped>
/* Layout — shared form/section/chip/visibility/library styles in editor-panels.css */
.cpub-pe-shell { display: flex; flex: 1; overflow: hidden; }

/* LEFT: Block Library */
.cpub-pe-library { width: 220px; flex-shrink: 0; background: var(--surface); border-right: 2px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-pe-lib-blocks { display: flex; flex-direction: column; gap: 1px; }
.cpub-pe-lib-block-label { font-size: 11px; flex: 1; }
.cpub-pe-lib-block-drag { font-size: 9px; color: var(--text-faint); opacity: 0; transition: opacity .1s; }
.cpub-ep-block-item:hover .cpub-pe-lib-block-drag { opacity: 1; }

/* Block variant icon colors */
.cpub-ep-block-item.proj .cpub-ep-block-icon { color: var(--yellow); }
.cpub-ep-block-item.proj:hover .cpub-ep-block-icon { background: var(--yellow-bg); border-color: var(--yellow-border); color: var(--yellow); }
.cpub-ep-block-item.tip .cpub-ep-block-icon { color: var(--green); }
.cpub-ep-block-item.tip:hover .cpub-ep-block-icon { background: var(--green-bg); border-color: var(--green-border); color: var(--green); }
.cpub-ep-block-item.inter .cpub-ep-block-icon { color: var(--accent); }
.cpub-ep-block-item.inter:hover .cpub-ep-block-icon { background: var(--accent-bg); border-color: var(--accent-border); color: var(--accent); }

/* CENTER: Canvas */
.cpub-pe-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-pe-canvas-inner { max-width: 820px; margin: 0 auto; padding: 28px 32px 80px; }

/* RIGHT: Settings */
.cpub-pe-settings { width: 280px; flex-shrink: 0; background: var(--surface); border-left: 2px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-pe-settings-body { flex: 1; overflow-y: auto; }

/* Toggle group (project-specific) */
.cpub-pe-toggle-group { display: flex; border: 2px solid var(--border); overflow: hidden; }
.cpub-pe-toggle-opt { flex: 1; padding: 5px 4px; text-align: center; font-size: 10px; font-family: var(--font-mono); cursor: pointer; color: var(--text-faint); background: transparent; border: none; border-right: 2px solid var(--border); transition: all .12s; }
.cpub-pe-toggle-opt:last-child { border-right: none; }
.cpub-pe-toggle-opt:hover { background: var(--surface2); color: var(--text-dim); }
.cpub-pe-toggle-opt.active { background: var(--accent-bg); color: var(--accent); }
.cpub-pe-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

/* Cover upload (project-specific) */
.cpub-pe-cover-upload-sm { border: 2px dashed var(--border); padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; background: var(--surface2); transition: all .15s; }
.cpub-pe-cover-upload-sm:hover { border-color: var(--accent); background: var(--surface3); }
.cpub-pe-cover-sm-icon { font-size: 18px; color: var(--text-faint); }
.cpub-pe-cover-sm-label { font-size: 11px; color: var(--text-dim); }
.cpub-pe-cover-sm-hint { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }

/* Checklist (project-specific) */
.cpub-pe-checklist { display: flex; flex-direction: column; gap: 5px; }
.cpub-pe-check-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-dim); }
.cpub-pe-check-item.pass { color: var(--text); }
.cpub-pe-check-item.fail { color: var(--text-faint); }
.cpub-pe-check-icon { font-size: 12px; width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; }
.cpub-pe-check-icon.pass { color: var(--green); }
.cpub-pe-check-icon.fail { color: var(--text-faint); }
.cpub-pe-checklist-summary { margin-top: 10px; padding: 8px 10px; background: var(--green-bg); border: 2px solid var(--green); display: flex; flex-direction: column; gap: 2px; }
.cpub-pe-checklist-count { font-size: 10px; font-family: var(--font-mono); color: var(--green); font-weight: 600; }
.cpub-pe-checklist-hint { font-size: 10px; color: var(--text-dim); }

/* Responsive */
@media (max-width: 1200px) { .cpub-pe-library { display: none; } }
@media (max-width: 1024px) { .cpub-pe-settings { display: none; } }
</style>
