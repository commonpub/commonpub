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

// --- Left: block library ---
const blockSearch = ref('');

const libGroups = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Paragraph', icon: 'fa-align-left' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading' },
      { type: 'bulletList', label: 'Bullet List', icon: 'fa-list-ul' },
      { type: 'orderedList', label: 'Ordered List', icon: 'fa-list-ol' },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left' },
    ],
  },
  {
    name: 'Media',
    blocks: [
      { type: 'image', label: 'Image', icon: 'fa-image' },
      { type: 'gallery', label: 'Gallery', icon: 'fa-images' },
      { type: 'video', label: 'Video Embed', icon: 'fa-film' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus' },
    ],
  },
  {
    name: 'Advanced',
    blocks: [
      { type: 'code_block', label: 'Code Block', icon: 'fa-code' },
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
    case 'bulletList': editor.chain().focus('end').toggleBulletList().run(); break;
    case 'orderedList': editor.chain().focus('end').toggleOrderedList().run(); break;
    case 'blockquote': editor.chain().focus('end').setBlockquote().run(); break;
    case 'image': editor.chain().focus('end').setImage({ src: '', alt: '' }).run(); break;
    case 'code_block': editor.chain().focus('end').setCodeBlock().run(); break;
    case 'horizontal_rule': editor.chain().focus('end').setHorizontalRule().run(); break;
    case 'callout': editor.chain().focus('end').insertContent({ type: 'callout', attrs: { variant: 'info' } }).run(); break;
    case 'gallery': editor.chain().focus('end').insertContent({ type: 'gallery', attrs: { images: [] } }).run(); break;
    case 'video': editor.chain().focus('end').insertContent({ type: 'video', attrs: { url: '', platform: 'youtube' } }).run(); break;
    case 'embed': editor.chain().focus('end').insertContent({ type: 'embed', attrs: { url: '', type: 'generic' } }).run(); break;
  }
}

// --- Right: properties ---
const openSections = ref<Record<string, boolean>>({
  metadata: true, seo: false, visibility: true, cover: false,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

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
  <div class="cpub-ae-shell">
    <!-- LEFT: Block Library -->
    <aside class="cpub-ae-left" aria-label="Block library">
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
    </aside>

    <!-- CENTER: Canvas -->
    <div class="cpub-ae-canvas">
      <div class="cpub-ae-canvas-inner">
        <slot />
      </div>
    </div>

    <!-- RIGHT: Properties -->
    <aside class="cpub-ae-right" aria-label="Document properties">
      <div class="cpub-ae-right-body">
        <!-- Metadata -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.metadata }">
          <button class="cpub-ep-section-header" @click="toggleSection('metadata')">
            <i class="fa fa-sliders cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Metadata</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Slug</label>
              <input class="cpub-ep-input" type="text" :value="metadata.slug" placeholder="auto-generated" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)">
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Description</label>
              <textarea class="cpub-ep-textarea" rows="3" :value="metadata.description as string" placeholder="Brief description..." @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Category</label>
              <select class="cpub-ep-select" :value="metadata.category || ''" @change="updateMeta('category', ($event.target as HTMLSelectElement).value)">
                <option value="">Select category</option>
                <option value="tutorial">Tutorial</option>
                <option value="guide">Guide</option>
                <option value="deep-dive">Deep Dive</option>
                <option value="opinion">Opinion</option>
              </select>
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

        <!-- SEO -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.seo }">
          <button class="cpub-ep-section-header" @click="toggleSection('seo')">
            <i class="fa fa-magnifying-glass cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">SEO</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">SEO Description</label>
              <textarea class="cpub-ep-textarea" rows="3" :value="metadata.seoDescription as string" placeholder="Search engine description..." @input="updateMeta('seoDescription', ($event.target as HTMLTextAreaElement).value)" />
              <span class="cpub-ep-hint">{{ ((metadata.seoDescription as string) || '').length }}/160</span>
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
            <div class="cpub-ep-vis-group">
              <button v-for="opt in [{ v: 'public', l: 'Public', d: 'Visible to everyone', i: 'fa-globe' }, { v: 'members', l: 'Members', d: 'Community members only', i: 'fa-users' }, { v: 'private', l: 'Private', d: 'Only you', i: 'fa-lock' }]" :key="opt.v" class="cpub-ep-vis-opt" :class="{ selected: (metadata.visibility || 'public') === opt.v }" @click="updateMeta('visibility', opt.v)">
                <span class="cpub-ep-vis-radio"><span class="cpub-ep-vis-dot" /></span>
                <span class="cpub-ep-vis-info"><span class="cpub-ep-vis-label">{{ opt.l }}</span><span class="cpub-ep-vis-desc">{{ opt.d }}</span></span>
                <i class="fa cpub-ep-vis-icon" :class="opt.i"></i>
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
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Image URL</label>
              <input class="cpub-ep-input" type="url" :value="metadata.coverImage" placeholder="https://..." @input="updateMeta('coverImage', ($event.target as HTMLInputElement).value)">
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
/* Layout only — shared form/section/chip/visibility/library styles in editor-panels.css */
.cpub-ae-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-ae-left { width: 220px; flex-shrink: 0; background: var(--surface); border-right: 2px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ae-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-ae-canvas-inner { max-width: 740px; margin: 0 auto; padding: 28px 32px 80px; }
.cpub-ae-right { width: 280px; flex-shrink: 0; background: var(--surface); border-left: 2px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-ae-right-body { flex: 1; overflow-y: auto; }

@media (max-width: 1024px) { .cpub-ae-left, .cpub-ae-right { display: none; } }
</style>
