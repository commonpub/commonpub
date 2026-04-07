<script setup lang="ts">
import { BlockCanvas, EditorBlocks, EditorSection, EditorTagInput, EditorVisibility, type BlockEditor, type BlockTypeGroup } from '@commonpub/editor/vue';

const props = defineProps<{
  blockEditor: BlockEditor;
  metadata: Record<string, unknown>;
}>();

const emit = defineEmits<{
  'update:metadata': [metadata: Record<string, unknown>];
}>();

const { user } = useAuth();

function updateMeta(key: string, value: unknown): void {
  emit('update:metadata', { ...props.metadata, [key]: value });
}

const blockTypes: BlockTypeGroup[] = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Paragraph', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section header' },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Blockquote' },
    ],
  },
  {
    name: 'Media',
    blocks: [
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or embed' },
      { type: 'code_block', label: 'Code Block', icon: 'fa-code', description: 'Syntax highlighted code' },
      { type: 'video', label: 'Video', icon: 'fa-film', description: 'YouTube, Vimeo embed' },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Visual separator' },
    ],
  },
  {
    name: 'Rich',
    blocks: [
      { type: 'callout', label: 'Callout', icon: 'fa-circle-info', description: 'Tip, warning, or note', attrs: { variant: 'info' } },
      { type: 'embed', label: 'Embed', icon: 'fa-globe', description: 'External embed' },
      { type: 'markdown', label: 'Markdown', icon: 'fa-brands fa-markdown', description: 'Raw markdown block' },
    ],
  },
];

const openSections = ref<Record<string, boolean>>({
  meta: true, excerpt: true, seo: true, publishing: true, author: true, social: false,
});
function toggleSection(key: string): void {
  openSections.value[key] = !openSections.value[key];
}

const tags = computed(() => (props.metadata.tags as string[]) || []);
function onTagsUpdate(newTags: string[]): void { updateMeta('tags', newTags); }

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

// --- Word count ---
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

const readTime = computed(() => Math.max(1, Math.round(wordCount.value / 200)));
const blockCount = computed(() => props.blockEditor.blocks.value.length);

// --- Author info ---
const authorName = computed(() => user.value?.name || 'Author');
const authorInitials = computed(() => {
  const name = authorName.value;
  const parts = name.split(/\s+/);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('').slice(0, 2);
});
const authorUsername = computed(() => user.value?.username || '');

// --- SEO preview ---
const seoDesc = computed(() => (props.metadata.seoDescription as string) || (props.metadata.description as string) || '');

// --- Schedule ---
const scheduleEnabled = ref(false);

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
</script>

<template>
  <div class="cpub-be-shell">
    <!-- Mobile sidebar toggles -->
    <div class="cpub-be-mobile-toggles">
      <button class="cpub-be-mobile-btn" aria-label="Toggle blocks panel" @click="toggleMobileLeft"><i class="fa-solid fa-layer-group"></i></button>
      <button class="cpub-be-mobile-btn" aria-label="Toggle properties panel" @click="toggleMobileRight"><i class="fa-solid fa-sliders"></i></button>
    </div>
    <div v-if="mobileLeftOpen || mobileRightOpen" class="cpub-be-mobile-overlay" @click="closeMobileSidebars" />

    <!-- LEFT: Block Library -->
    <aside class="cpub-be-library" :class="{ 'cpub-be-sidebar-open': mobileLeftOpen }" aria-label="Block library">
      <EditorBlocks :groups="blockTypes" :block-editor="blockEditor" />
    </aside>

    <!-- CENTER: Canvas with toolbar, cover, title, subtitle, byline, blocks -->
    <div class="cpub-be-center">
      <!-- Canvas toolbar -->
      <div class="cpub-be-canvas-toolbar">
        <div class="cpub-be-viewport-tabs">
          <button class="cpub-be-viewport-tab" :class="{ active: viewportMode === 'desktop' }" title="Desktop" @click="viewportMode = 'desktop'"><i class="fa-solid fa-desktop"></i></button>
          <button class="cpub-be-viewport-tab" :class="{ active: viewportMode === 'tablet' }" title="Tablet" @click="viewportMode = 'tablet'"><i class="fa-solid fa-tablet-screen-button"></i></button>
          <button class="cpub-be-viewport-tab" :class="{ active: viewportMode === 'mobile' }" title="Mobile" @click="viewportMode = 'mobile'"><i class="fa-solid fa-mobile-screen"></i></button>
        </div>
      </div>

      <div class="cpub-be-canvas" :style="{ maxWidth: canvasMaxWidth }">
        <!-- Cover image area -->
        <div class="cpub-be-cover" :class="{ 'has-image': !!coverImageUrl }">
          <template v-if="coverImageUrl">
            <img :src="coverImageUrl" alt="Cover image" class="cpub-be-cover-img" />
            <div class="cpub-be-cover-actions">
              <button class="cpub-be-cover-btn" @click="removeCover">
                <i class="fa-solid fa-trash"></i> Remove
              </button>
              <label class="cpub-be-cover-btn">
                <i class="fa-solid fa-arrow-up-from-bracket"></i> Replace
                <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
              </label>
            </div>
          </template>
          <template v-else>
            <div class="cpub-be-cover-placeholder">
              <div class="cpub-be-cover-icon"><i class="fa-regular fa-image"></i></div>
              <span class="cpub-be-cover-text">Cover image</span>
            </div>
            <div class="cpub-be-cover-overlay">
              <label class="cpub-be-cover-btn primary">
                <i class="fa-solid fa-arrow-up-from-bracket"></i> Upload
                <input type="file" accept="image/*" class="cpub-sr-only" @change="onCoverUpload">
              </label>
              <button class="cpub-be-cover-btn" @click="onCoverUrl">
                <i class="fa-solid fa-link"></i> From URL
              </button>
            </div>
          </template>
        </div>

        <!-- Title -->
        <textarea
          class="cpub-be-title"
          rows="2"
          placeholder="Your post title..."
          :value="(metadata.title as string) || ''"
          @input="updateMeta('title', ($event.target as HTMLTextAreaElement).value)"
        />

        <!-- Subtitle -->
        <textarea
          class="cpub-be-subtitle"
          rows="1"
          placeholder="Add a subtitle (optional)..."
          :value="(metadata.subtitle as string) || ''"
          @input="updateMeta('subtitle', ($event.target as HTMLTextAreaElement).value)"
        />

        <!-- Byline -->
        <div class="cpub-be-byline">
          <div class="cpub-be-byline-av">{{ authorInitials }}</div>
          <div class="cpub-be-byline-info">
            <div class="cpub-be-byline-name">{{ authorName }}</div>
            <div class="cpub-be-byline-meta">
              <span>{{ new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
              <span class="cpub-be-sep">&middot;</span>
              <span>{{ readTime }} min read</span>
              <template v-if="metadata.category">
                <span class="cpub-be-sep">&middot;</span>
                <span class="cpub-be-category-tag">{{ metadata.category }}</span>
              </template>
            </div>
          </div>
        </div>

        <!-- Block editor canvas -->
        <BlockCanvas :block-editor="blockEditor" :block-types="blockTypes" />
      </div>

      <!-- Word count bar -->
      <div class="cpub-be-wc-bar">
        <div class="cpub-be-wc-stat"><i class="fa-solid fa-font"></i> <span>{{ wordCount }}</span> words</div>
        <div class="cpub-be-wc-stat"><i class="fa-regular fa-clock"></i> <span>{{ readTime }}</span> min read</div>
        <div class="cpub-be-wc-stat"><i class="fa-solid fa-paragraph"></i> <span>{{ blockCount }}</span> blocks</div>
        <div class="cpub-be-wc-spacer" />
      </div>
    </div>

    <!-- RIGHT: Properties -->
    <aside class="cpub-be-right" :class="{ 'cpub-be-sidebar-open': mobileRightOpen }" aria-label="Blog properties">
      <div class="cpub-be-right-body">
        <!-- Meta -->
        <EditorSection title="Meta" icon="fa-tag" :open="openSections.meta" @toggle="toggleSection('meta')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Slug</label>
            <input class="cpub-ep-input cpub-ep-input-mono" type="text" :value="metadata.slug" placeholder="auto-generated" @input="updateMeta('slug', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Category</label>
            <select class="cpub-ep-select" :value="metadata.category || ''" @change="updateMeta('category', ($event.target as HTMLSelectElement).value)">
              <option value="">Select category</option>
              <option value="hardware">Hardware &amp; Makers</option>
              <option value="software">Software</option>
              <option value="ai-ml">AI &amp; ML</option>
              <option value="homelab">Home Lab</option>
              <option value="tutorial">Tutorial</option>
              <option value="opinion">Opinion</option>
            </select>
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Tags</label>
            <EditorTagInput :tags="tags" @update:tags="onTagsUpdate" />
          </div>
        </EditorSection>

        <!-- Excerpt / Description -->
        <EditorSection title="Excerpt" icon="fa-align-left" :open="openSections.excerpt" @toggle="toggleSection('excerpt')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Custom Excerpt</label>
            <textarea class="cpub-ep-textarea" rows="3" :value="(metadata.description as string) || ''" placeholder="Short description shown in feed previews..." @input="updateMeta('description', ($event.target as HTMLTextAreaElement).value)" />
            <span class="cpub-ep-hint cpub-ep-hint-right">{{ ((metadata.description as string) || '').length }} / 300</span>
          </div>
        </EditorSection>

        <!-- SEO Preview -->
        <EditorSection title="SEO Preview" icon="fa-brands fa-google" :open="openSections.seo" @toggle="toggleSection('seo')">
          <div class="cpub-be-seo-card">
            <div class="cpub-be-seo-url">
              <span class="cpub-be-seo-favicon">C</span>
              commonpub.io &rsaquo; {{ authorUsername ? `@${authorUsername}` : 'blog' }}
            </div>
            <div class="cpub-be-seo-title">{{ (metadata.title as string) || 'Post title' }}</div>
            <div class="cpub-be-seo-desc">{{ seoDesc || 'Post description will appear here...' }}</div>
          </div>
          <div class="cpub-ep-field" style="margin-top: 10px;">
            <label class="cpub-ep-flabel">SEO Description</label>
            <textarea class="cpub-ep-textarea" rows="3" :value="(metadata.seoDescription as string) || ''" placeholder="Search engine description..." @input="updateMeta('seoDescription', ($event.target as HTMLTextAreaElement).value)" />
            <span class="cpub-ep-hint cpub-ep-hint-right">{{ ((metadata.seoDescription as string) || '').length }}/160</span>
          </div>
        </EditorSection>

        <!-- Publishing -->
        <EditorSection title="Publishing" icon="fa-globe" :open="openSections.publishing" @toggle="toggleSection('publishing')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Visibility</label>
            <EditorVisibility :model-value="(metadata.visibility as string) || 'public'" @update:model-value="(v: string) => updateMeta('visibility', v)" />
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-be-schedule-row">
              <span class="cpub-be-toggle-switch">
                <input v-model="scheduleEnabled" type="checkbox" />
                <span class="cpub-be-toggle-track" />
              </span>
              <span class="cpub-be-toggle-label">Schedule for later</span>
            </label>
          </div>
          <div v-if="scheduleEnabled" class="cpub-ep-field">
            <label class="cpub-ep-flabel">Publish Date</label>
            <input class="cpub-ep-input cpub-ep-input-mono" type="datetime-local" :value="metadata.scheduledAt" @input="updateMeta('scheduledAt', ($event.target as HTMLInputElement).value)">
          </div>
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Series <span class="cpub-ep-optional">(optional)</span></label>
            <input class="cpub-ep-input" type="text" :value="metadata.series" placeholder="e.g. Home Lab Chronicles" @input="updateMeta('series', ($event.target as HTMLInputElement).value)">
          </div>
        </EditorSection>

        <!-- Author -->
        <EditorSection title="Author" icon="fa-user" :open="openSections.author" @toggle="toggleSection('author')">
          <div class="cpub-be-author-row">
            <div class="cpub-be-author-av">{{ authorInitials }}</div>
            <div class="cpub-be-author-info">
              <div class="cpub-be-author-name">{{ authorName }}</div>
              <div class="cpub-be-author-role">{{ authorUsername ? `@${authorUsername}` : '' }}</div>
            </div>
            <span class="cpub-be-author-badge">You</span>
          </div>
        </EditorSection>

        <!-- Social -->
        <EditorSection title="Social" icon="fa-share-nodes" :open="openSections.social" @toggle="toggleSection('social')">
          <div class="cpub-ep-field">
            <label class="cpub-ep-flabel">Open Graph Image</label>
            <div class="cpub-be-og-thumb">
              <div class="cpub-be-og-overlay">
                <i class="fa-solid fa-arrow-up-from-bracket"></i>
                <span>Upload OG image</span>
              </div>
            </div>
          </div>
        </EditorSection>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.cpub-be-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-be-library { width: 220px; flex-shrink: 0; background: var(--surface); border-right: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-be-center { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.cpub-be-canvas { flex: 1; overflow-y: auto; background: var(--bg); margin: 0 auto; width: 100%; transition: max-width 0.2s; }

/* Canvas toolbar */
.cpub-be-canvas-toolbar {
  display: flex; align-items: center; gap: 2px; padding: 4px 12px;
  background: var(--surface); border-bottom: var(--border-width-default) solid var(--border); flex-shrink: 0; min-height: 32px;
  justify-content: flex-end;
}
.cpub-be-viewport-tabs { display: flex; gap: 0; }
.cpub-be-viewport-tab {
  width: 28px; height: 24px; display: flex; align-items: center; justify-content: center;
  background: none; border: var(--border-width-default) solid var(--border); border-left-width: 0; color: var(--text-faint);
  font-size: 10px; cursor: pointer;
}
.cpub-be-viewport-tab:first-child { border-left-width: 2px; }
.cpub-be-viewport-tab.active { background: var(--border); color: var(--color-text-inverse); }
.cpub-be-viewport-tab:hover:not(.active) { background: var(--surface2); color: var(--text-dim); }
.cpub-be-right { width: 320px; flex-shrink: 0; background: var(--surface); border-left: var(--border-width-default) solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
.cpub-be-right-body { flex: 1; overflow-y: auto; }

/* Cover image */
.cpub-be-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16/7;
  background: var(--surface2);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.cpub-be-cover-img { width: 100%; height: 100%; object-fit: cover; }
.cpub-be-cover-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.cpub-be-cover-icon { font-size: 28px; color: var(--text-faint); }
.cpub-be-cover-text { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-be-cover-overlay, .cpub-be-cover-actions {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--color-surface-scrim); opacity: 0; transition: opacity 0.15s;
}
.cpub-be-cover:hover .cpub-be-cover-overlay,
.cpub-be-cover:hover .cpub-be-cover-actions,
.cpub-be-cover:focus-within .cpub-be-cover-overlay,
.cpub-be-cover:focus-within .cpub-be-cover-actions { opacity: 1; }
.cpub-be-cover-btn {
  font-size: 11px; padding: 6px 12px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  color: var(--text-dim); cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--font-mono); box-shadow: var(--shadow-sm);
}
.cpub-be-cover-btn.primary { background: var(--accent); color: var(--color-text-inverse); border-color: var(--accent); box-shadow: var(--shadow-sm); }
.cpub-be-cover-btn:hover { background: var(--surface2); }
.cpub-be-cover-btn.primary:hover { opacity: 0.9; background: var(--accent); }

/* Title & Subtitle in canvas */
.cpub-be-title {
  width: 100%; border: none; outline: none; resize: none; background: transparent;
  font-size: 28px; font-weight: 700; line-height: 1.25; color: var(--text);
  padding: 24px 48px 0; font-family: var(--font-sans, system-ui);
}
.cpub-be-title::placeholder { color: var(--text-faint); }
.cpub-be-subtitle {
  width: 100%; border: none; outline: none; resize: none; background: transparent;
  font-size: 16px; font-weight: 400; line-height: 1.5; color: var(--text-dim);
  padding: 8px 48px 0; font-family: var(--font-sans, system-ui);
}
.cpub-be-subtitle::placeholder { color: var(--text-faint); }

/* Byline */
.cpub-be-byline {
  display: flex; align-items: center; gap: 10px; padding: 16px 48px 8px;
}
.cpub-be-byline-av {
  width: 32px; height: 32px; border-radius: 50%; background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: var(--color-text-inverse); flex-shrink: 0; border: var(--border-width-default) solid var(--border);
}
.cpub-be-byline-info { flex: 1; }
.cpub-be-byline-name { font-size: 13px; font-weight: 600; color: var(--text); }
.cpub-be-byline-meta { font-size: 11px; color: var(--text-faint); display: flex; align-items: center; gap: 4px; }
.cpub-be-sep { color: var(--text-faint); }
.cpub-be-category-tag { color: var(--accent); }

/* Word count bar */
.cpub-be-wc-bar {
  display: flex; align-items: center; gap: 18px; padding: 10px 40px;
  background: var(--surface); border-top: var(--border-width-default) solid var(--border); flex-shrink: 0;
}
.cpub-be-wc-stat {
  font-family: var(--font-mono); font-size: 10px; color: var(--text-faint);
  display: flex; align-items: center; gap: 5px;
}
.cpub-be-wc-stat i { font-size: 9px; }
.cpub-be-wc-stat span { color: var(--text-dim); }
.cpub-be-wc-spacer { flex: 1; }

/* Right panel extras */
.cpub-ep-input-mono { font-family: var(--font-mono); font-size: 11px; }
.cpub-ep-hint-right { text-align: right; display: block; }
.cpub-ep-optional { font-size: 9px; font-weight: 400; color: var(--text-faint); }

/* SEO card */
.cpub-be-seo-card {
  background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 14px;
  font-family: Arial, sans-serif; box-shadow: var(--shadow-sm);
}
.cpub-be-seo-url { font-size: 11px; color: var(--green); margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
.cpub-be-seo-favicon {
  width: 14px; height: 14px; background: var(--accent); display: inline-flex;
  align-items: center; justify-content: center; font-size: 8px; color: var(--color-text-inverse);
  font-weight: 700; flex-shrink: 0; border: var(--border-width-default) solid var(--border);
}
.cpub-be-seo-title { font-size: 15px; color: var(--accent); margin-bottom: 4px; line-height: 1.3; }
.cpub-be-seo-desc { font-size: 12px; color: var(--text-dim); line-height: 1.45; }

/* Schedule toggle */
.cpub-be-schedule-row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.cpub-be-toggle-switch {
  position: relative; width: 30px; height: 16px; flex-shrink: 0;
}
.cpub-be-toggle-switch input { display: none; }
.cpub-be-toggle-track {
  display: block; width: 100%; height: 100%; background: var(--surface3);
  border: var(--border-width-default) solid var(--border); cursor: pointer; transition: background 0.15s; position: relative;
}
.cpub-be-toggle-track::after {
  content: ''; position: absolute; width: 8px; height: 8px;
  background: var(--text-faint); top: 2px; left: 2px; transition: all 0.15s;
}
.cpub-be-toggle-switch input:checked + .cpub-be-toggle-track { background: var(--accent); border-color: var(--border); }
.cpub-be-toggle-switch input:checked + .cpub-be-toggle-track::after { left: 16px; background: #fff; }
.cpub-be-toggle-label { font-size: 12px; color: var(--text-dim); }

/* Author row */
.cpub-be-author-row {
  display: flex; align-items: center; gap: 10px; padding: 10px;
  background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-sm);
}
.cpub-be-author-av {
  width: 32px; height: 32px; border-radius: 50%; background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: var(--color-text-inverse); flex-shrink: 0; border: var(--border-width-default) solid var(--border);
}
.cpub-be-author-info { flex: 1; }
.cpub-be-author-name { font-size: 12px; font-weight: 600; color: var(--text); }
.cpub-be-author-role { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); }
.cpub-be-author-badge {
  font-family: var(--font-mono); font-size: 9px; padding: 2px 6px;
  background: var(--accent-bg); border: var(--border-width-default) solid var(--accent); color: var(--accent);
}

/* OG thumb */
.cpub-be-og-thumb {
  width: 100%; aspect-ratio: 1200/630; background: var(--surface2);
  border: var(--border-width-default) solid var(--border); overflow: hidden; position: relative; cursor: pointer;
  background-image: linear-gradient(var(--border2) 1px, transparent 1px), linear-gradient(90deg, var(--border2) 1px, transparent 1px);
  background-size: 20px 20px;
}
.cpub-be-og-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 5px; background: var(--color-surface-scrim);
  opacity: 0; transition: opacity 0.15s;
}
.cpub-be-og-thumb:hover .cpub-be-og-overlay { opacity: 1; }
.cpub-be-og-overlay i { font-size: 18px; color: var(--text-dim); }
.cpub-be-og-overlay span { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); }

.cpub-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

/* Mobile sidebar toggles */
.cpub-be-mobile-toggles { display: none; }
.cpub-be-mobile-overlay { display: none; }

@media (max-width: 1200px) {
  .cpub-be-library {
    position: fixed; top: 0; bottom: 0; left: 0; z-index: 200;
    transform: translateX(-100%); transition: transform 0.2s ease;
  }
  .cpub-be-library.cpub-be-sidebar-open { transform: translateX(0); }
}

@media (max-width: 1024px) {
  .cpub-be-right {
    position: fixed; top: 0; bottom: 0; right: 0; z-index: 200;
    transform: translateX(100%); transition: transform 0.2s ease;
  }
  .cpub-be-right.cpub-be-sidebar-open { transform: translateX(0); }

  .cpub-be-mobile-toggles {
    display: flex; position: fixed; bottom: 16px; right: 16px;
    gap: 8px; z-index: 100;
  }
  .cpub-be-mobile-btn {
    width: 44px; height: 44px; border: var(--border-width-default) solid var(--border); background: var(--surface);
    color: var(--text-dim); font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow-md);
  }
  .cpub-be-mobile-btn:hover { background: var(--surface2); color: var(--text); }
  .cpub-be-mobile-overlay {
    display: block; position: fixed; inset: 0;
    background: var(--color-surface-overlay-light); z-index: 199;
  }
}

/* Touch devices: always show cover overlays and OG overlay */
@media (hover: none) {
  .cpub-be-cover-overlay,
  .cpub-be-cover-actions { opacity: 1; }
  .cpub-be-og-overlay { opacity: 1; }
}
</style>
