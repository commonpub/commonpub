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

// --- Right panel sections ---
const openSections = ref<Record<string, boolean>>({
  meta: true, excerpt: false, seo: false, publishing: true, author: false, social: false,
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
  <div class="cpub-be-shell">
    <!-- CENTER: Editor Canvas (blog has no left panel per mockup) -->
    <div class="cpub-be-canvas">
      <div class="cpub-be-canvas-inner">
        <slot />
      </div>
    </div>

    <!-- RIGHT: Properties -->
    <aside class="cpub-be-right" aria-label="Blog properties">
      <div class="cpub-be-right-body">
        <!-- Meta -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.meta }">
          <button class="cpub-ep-section-header" @click="toggleSection('meta')">
            <i class="fa fa-sliders cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Meta</span>
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
              <label class="cpub-ep-flabel">Series</label>
              <input class="cpub-ep-input" type="text" :value="metadata.series" placeholder="Series name..." @input="updateMeta('series', ($event.target as HTMLInputElement).value)">
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

        <!-- Excerpt -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.excerpt }">
          <button class="cpub-ep-section-header" @click="toggleSection('excerpt')">
            <i class="fa fa-quote-right cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Excerpt</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <textarea class="cpub-ep-textarea" rows="3" :value="metadata.excerpt as string" placeholder="Custom excerpt for cards and feeds..." @input="updateMeta('excerpt', ($event.target as HTMLTextAreaElement).value)" />
              <span class="cpub-ep-hint">{{ ((metadata.excerpt as string) || '').length }}/280</span>
            </div>
          </div>
        </div>

        <!-- SEO -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.seo }">
          <button class="cpub-ep-section-header" @click="toggleSection('seo')">
            <i class="fa fa-magnifying-glass cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">SEO Preview</span>
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

        <!-- Publishing -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.publishing }">
          <button class="cpub-ep-section-header" @click="toggleSection('publishing')">
            <i class="fa fa-eye cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Publishing</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Visibility</label>
              <select class="cpub-ep-select" :value="metadata.visibility || 'public'" @change="updateMeta('visibility', ($event.target as HTMLSelectElement).value)">
                <option value="public">Public</option>
                <option value="members">Members only</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">Cover Image</label>
              <input class="cpub-ep-input" type="url" :value="metadata.coverImage" placeholder="https://..." @input="updateMeta('coverImage', ($event.target as HTMLInputElement).value)">
            </div>
          </div>
        </div>

        <!-- Social -->
        <div class="cpub-ep-section" :class="{ collapsed: !openSections.social }">
          <button class="cpub-ep-section-header" @click="toggleSection('social')">
            <i class="fa fa-share-nodes cpub-ep-sec-icon"></i>
            <span class="cpub-ep-sec-label">Social</span>
            <i class="fa fa-chevron-down cpub-ep-sec-arrow"></i>
          </button>
          <div class="cpub-ep-section-body">
            <div class="cpub-ep-field">
              <label class="cpub-ep-flabel">OG Image URL</label>
              <input class="cpub-ep-input" type="url" :value="metadata.ogImage" placeholder="https://..." @input="updateMeta('ogImage', ($event.target as HTMLInputElement).value)">
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
/* Layout only — shared form/section/chip styles in editor-panels.css */
.cpub-be-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-be-canvas { flex: 1; overflow-y: auto; background: var(--bg); }
.cpub-be-canvas-inner { max-width: 720px; margin: 0 auto; padding: 28px 32px 80px; }
.cpub-be-right { width: 300px; flex-shrink: 0; background: var(--surface); border-left: 2px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-be-right-body { flex: 1; overflow-y: auto; }

@media (max-width: 1024px) { .cpub-be-right { display: none; } }
</style>
