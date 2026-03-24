<script setup lang="ts">
import type { Component } from 'vue';
definePageMeta({ layout: false, middleware: 'auth' });

const route = useRoute();
const contentType = computed(() => route.params.type as string);
const slug = computed(() => route.params.slug as string);
const isNew = ref(slug.value === 'new');
const showStarterForm = ref(isNew.value);
const starterSaving = ref(false);

useSeoMeta({
  title: () => isNew.value ? `New ${contentType.value} — CommonPub` : `Edit — CommonPub`,
});

const title = ref('');
const metadata = ref<Record<string, unknown>>({
  description: '',
  slug: '',
  tags: [],
  visibility: 'public',
  coverImageUrl: '',
});
const isDirty = ref(false);
const { extract: extractError } = useApiError();
const mode = ref<'write' | 'preview' | 'code'>('write');
const contentId = ref<string | null>(null);

// --- Block editor ---
const blockEditor = useBlockEditor();

// --- Content save composable ---
const {
  saving,
  error,
  autoSaveStatus,
  silentSave,
  handlePublish: doPublish,
  buildSaveBody,
  cancelAutoSave,
  initAutoSave,
  cleanup,
} = useContentSave({
  contentType,
  title,
  metadata,
  isNew,
  contentId,
  isDirty,
  getBlockTuples: () => blockEditor.toBlockTuples(),
  extractError,
  onAfterSave: syncBOM,
});

// --- Publish validation ---
const { errors: publishErrors, showErrors: showPublishErrors, validate, dismiss: dismissPublishErrors } = usePublishValidation({
  title,
  metadata,
  getBlockTuples: () => blockEditor.toBlockTuples(),
});

// --- Specialized editor component map ---
const editorMap: Record<string, Component> = {
  article: resolveComponent('EditorsArticleEditor') as Component,
  blog: resolveComponent('EditorsBlogEditor') as Component,
  explainer: resolveComponent('EditorsExplainerEditor') as Component,
  project: resolveComponent('EditorsProjectEditor') as Component,
};
const editorComponent = computed<Component | null>(() => editorMap[contentType.value] ?? null);
const hasSpecializedEditor = computed(() => editorComponent.value !== null);

// --- Load existing content ---
const requestHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {};
if (!isNew.value) {
  const { data } = await useFetch(() => `/api/content/${slug.value}`, { headers: requestHeaders });
  if (data.value) {
    const d = data.value as Record<string, unknown>;
    contentId.value = d.id as string;
    title.value = d.title as string;
    if (Array.isArray(d.content)) {
      blockEditor.fromBlockTuples(d.content as [string, Record<string, unknown>][]);
    }
    metadata.value = {
      description: (d.description as string) || '',
      slug: (d.slug as string) || '',
      tags: d.tags ? (d.tags as { name: string }[]).map((t) => t.name) : [],
      visibility: (d.visibility as string) || 'public',
      coverImageUrl: (d.coverImageUrl as string) || '',
      seoDescription: (d.seoDescription as string) || '',
      difficulty: (d.difficulty as string) || '',
      buildTime: (d.buildTime as string) || '',
      estimatedCost: (d.estimatedCost as string) || '',
      estimatedMinutes: (d.estimatedMinutes as number) || undefined,
      licenseType: (d.licenseType as string) || '',
      series: (d.series as string) || '',
      category: (d.category as string) || '',
      subtitle: (d.subtitle as string) || '',
    };
  }
}

// --- Auto-generate slug from title ---
const slugManuallyEdited = ref(false);
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 128);
}
watch(title, (newTitle) => {
  if (!slugManuallyEdited.value && isNew.value) {
    metadata.value = { ...metadata.value, slug: slugify(newTitle) };
  }
});

// --- Dirty tracking + autosave ---
watch(() => blockEditor.blocks.value, () => { isDirty.value = true; }, { deep: true });
initAutoSave([() => blockEditor.blocks.value, title, metadata]);

function handleMetadataUpdate(newMetadata: Record<string, unknown>): void {
  if (newMetadata.title !== undefined && typeof newMetadata.title === 'string') {
    title.value = newMetadata.title;
    delete newMetadata.title;
  }
  metadata.value = newMetadata;
  isDirty.value = true;
}

// --- BOM sync ---
async function syncBOM(id: string): Promise<void> {
  const blocks = blockEditor.toBlockTuples();
  const productItems: Array<{ productId: string; quantity: number; notes?: string }> = [];
  for (const [type, content] of blocks) {
    if (type === 'partsList' && Array.isArray(content.parts)) {
      for (const part of content.parts as Array<{ productId?: string; qty?: number; notes?: string }>) {
        if (part.productId) {
          productItems.push({ productId: part.productId, quantity: part.qty ?? 1, notes: part.notes });
        }
      }
    }
  }
  if (productItems.length > 0 || contentType.value === 'project') {
    await $fetch(`/api/content/${id}/products-sync`, { method: 'POST', body: { items: productItems } }).catch(() => {});
  }
}

// --- Starter form submit ---
async function handleStarterSubmit(): Promise<void> {
  if (!title.value.trim()) { error.value = 'Title is required'; return; }
  starterSaving.value = true;
  error.value = '';
  try {
    const body = buildSaveBody();
    const result = await $fetch<{ id: string; slug: string }>('/api/content', { method: 'POST', body });
    contentId.value = result.id;
    isNew.value = false;
    isDirty.value = false;
    showStarterForm.value = false;
    history.replaceState({}, '', `/${contentType.value}/${result.slug}/edit`);
  } catch (err: unknown) {
    error.value = extractError(err);
  } finally {
    starterSaving.value = false;
  }
}

// --- Publish with validation ---
async function handlePublish(): Promise<void> {
  const errs = await doPublish(validate);
  // doPublish navigates on success; errors are shown via publishErrors
}

// --- Preview mode ---
function enterPreview(): void {
  mode.value = 'preview';
  if (isDirty.value && title.value && !saving.value && !isNew.value && contentId.value) {
    cancelAutoSave();
    silentSave();
  }
}

// --- Keyboard shortcuts ---
function onKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
    event.preventDefault();
    cancelAutoSave();
    silentSave();
  }
  if (event.key === 'Escape' && mode.value === 'preview' && contentType.value === 'explainer') {
    mode.value = 'write';
  }
}

onMounted(() => { document.addEventListener('keydown', onKeydown); });
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); cleanup(); });

// --- Warn before unload ---
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (isDirty.value) event.preventDefault();
}
if (import.meta.client) {
  onMounted(() => { window.addEventListener('beforeunload', onBeforeUnload); });
  onUnmounted(() => { window.removeEventListener('beforeunload', onBeforeUnload); });
}
</script>

<template>
  <!-- Starter form for new content -->
  <ContentStarterForm
    v-if="showStarterForm"
    :content-type="contentType"
    :title="title"
    :metadata="metadata"
    :saving="starterSaving"
    :error="error"
    @update:title="title = $event"
    @update:metadata="metadata = $event"
    @submit="handleStarterSubmit"
  />

  <!-- Main editor -->
  <div v-else class="cpub-editor-layout">
    <!-- Publish validation errors -->
    <PublishErrorsModal :errors="publishErrors" :show="showPublishErrors" @dismiss="dismissPublishErrors" />

    <!-- Top bar -->
    <header class="cpub-editor-topbar">
      <NuxtLink to="/" class="cpub-editor-logo" aria-label="Home">
        <span class="cpub-logo-accent">[</span>cpub<span class="cpub-logo-accent">]</span>
      </NuxtLink>
      <button class="cpub-editor-back" aria-label="Go back" @click="$router.back()">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div class="cpub-topbar-divider" aria-hidden="true" />
      <div class="cpub-topbar-title-wrap">
        <input
          v-model="title"
          type="text"
          class="cpub-topbar-title-input"
          :placeholder="`Untitled ${contentType}...`"
          aria-label="Content title"
        />
        <span v-if="isDirty" class="cpub-unsaved-dot" title="Unsaved changes" />
        <span v-if="autoSaveStatus === 'saving'" class="cpub-autosave-status">
          <i class="fa-solid fa-circle-notch fa-spin"></i> Saving...
        </span>
        <span v-else-if="autoSaveStatus === 'saved'" class="cpub-autosave-status cpub-autosave-status--saved">
          <i class="fa-solid fa-check"></i> Saved
        </span>
        <span v-else-if="autoSaveStatus === 'error'" class="cpub-autosave-status cpub-autosave-status--error">
          <i class="fa-solid fa-exclamation-triangle"></i> Save failed
        </span>
      </div>
      <div class="cpub-mode-tabs">
        <button :class="['cpub-mode-tab', { active: mode === 'write' }]" @click="mode = 'write'">Write</button>
        <button :class="['cpub-mode-tab', { active: mode === 'preview' }]" @click="enterPreview">Preview</button>
        <button :class="['cpub-mode-tab', { active: mode === 'code' }]" @click="mode = 'code'">Code</button>
      </div>
      <div class="cpub-topbar-spacer" />
      <div class="cpub-topbar-actions">
        <button class="cpub-topbar-btn" :disabled="saving || !title" @click="silentSave">
          {{ saving ? 'Saving...' : 'Save Draft' }}
        </button>
        <button class="cpub-topbar-btn cpub-topbar-btn-primary" :disabled="saving || !title" @click="handlePublish">
          Publish
        </button>
      </div>
    </header>

    <div v-if="error" class="cpub-editor-error" role="alert">{{ error }}</div>

    <!-- Write mode with specialized editor -->
    <template v-if="mode === 'write' && hasSpecializedEditor">
      <component
        :is="editorComponent"
        :block-editor="blockEditor"
        :metadata="contentType === 'blog' ? { ...metadata, title: title } : metadata"
        @update:metadata="handleMetadataUpdate"
      />
    </template>

    <!-- Write mode — fallback generic editor -->
    <div v-else-if="mode === 'write'" class="cpub-editor-shell">
      <div class="cpub-editor-canvas">
        <EditorsBlockCanvas :block-editor="blockEditor" :block-types="[]" />
      </div>
    </div>

    <!-- Preview mode -->
    <div v-else-if="mode === 'preview'" class="cpub-editor-shell" :class="{ 'cpub-hidden': contentType === 'explainer' }">
      <div class="cpub-preview-canvas">
        <h1 class="cpub-preview-title">{{ title || 'Untitled' }}</h1>
        <p v-if="metadata.description" class="cpub-preview-desc">{{ metadata.description }}</p>
        <div class="cpub-preview-blocks">
          <BlocksBlockContentRenderer :blocks="blockEditor.toBlockTuples()" />
        </div>
      </div>
    </div>

    <!-- Code mode -->
    <div v-else class="cpub-editor-shell">
      <div class="cpub-code-canvas">
        <pre class="cpub-code-view">{{ JSON.stringify(blockEditor.toBlockTuples(), null, 2) }}</pre>
      </div>
    </div>

    <!-- Explainer preview overlay -->
    <Teleport to="body">
      <div v-if="mode === 'preview' && contentType === 'explainer'" class="cpub-explainer-preview-overlay">
        <button class="cpub-preview-close-btn" @click="mode = 'write'" aria-label="Close preview">
          <i class="fa-solid fa-xmark"></i>
          <span>Back to Editor</span>
        </button>
        <ViewsExplainerView
          :content="{
            id: contentId || 'preview',
            type: 'explainer',
            title: title || 'Untitled',
            slug: (metadata.slug as string) || 'preview',
            subtitle: null,
            description: (metadata.description as string) || null,
            content: blockEditor.toBlockTuples(),
            coverImageUrl: (metadata.coverImageUrl as string) || null,
            category: null,
            difficulty: (metadata.difficulty as string) || null,
            buildTime: null,
            estimatedCost: null,
            status: 'draft',
            visibility: (metadata.visibility as string) || 'public',
            isFeatured: false,
            seoDescription: null,
            previewToken: null,
            parts: null,
            sections: null,
            viewCount: 0,
            likeCount: 0,
            commentCount: 0,
            forkCount: 0,
            publishedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            licenseType: null,
            series: null,
            estimatedMinutes: null,
            tags: [],
            author: { id: '', username: '', displayName: null, avatarUrl: null },
          }"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cpub-editor-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
}

.cpub-editor-topbar {
  height: 48px;
  background: var(--surface);
  border-bottom: var(--border-width-default, 2px) solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 0;
  flex-shrink: 0;
  z-index: 100;
}

.cpub-editor-logo {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  letter-spacing: 0.06em;
  text-decoration: none;
  flex-shrink: 0;
}
.cpub-logo-accent { color: var(--accent); }

.cpub-editor-back {
  width: 30px; height: 30px;
  background: none;
  border: 2px solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
  margin-left: 6px;
  flex-shrink: 0;
}
.cpub-editor-back:hover { background: var(--surface2); border-color: var(--border2); color: var(--text); }

.cpub-topbar-divider { width: 2px; height: 22px; background: var(--border); margin: 0 12px; flex-shrink: 0; }

.cpub-topbar-title-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }

.cpub-topbar-title-input {
  font-size: 13px; font-weight: 500; color: var(--text);
  background: none; border: 2px solid transparent;
  padding: 4px 8px; cursor: text;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 380px; outline: none;
  font-family: var(--font-sans, system-ui);
}
.cpub-topbar-title-input:hover { border-color: var(--border2); background: var(--surface2); }
.cpub-topbar-title-input:focus { border-color: var(--accent); background: var(--surface2); }

.cpub-unsaved-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--yellow); flex-shrink: 0; }

.cpub-autosave-status { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.cpub-autosave-status--saved { color: var(--green); }
.cpub-autosave-status--error { color: var(--red); }

.cpub-mode-tabs { display: flex; background: var(--surface2); border: 2px solid var(--border); padding: 2px; flex-shrink: 0; margin: 0 10px; }
.cpub-mode-tab { font-family: var(--font-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 14px; border: none; background: none; color: var(--text-dim); cursor: pointer; }
.cpub-mode-tab.active { background: var(--surface); color: var(--text); box-shadow: 2px 2px 0 var(--border); }
.cpub-mode-tab:hover:not(.active) { color: var(--text); }

.cpub-topbar-spacer { flex: 1; }
.cpub-topbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.cpub-topbar-btn { font-family: var(--font-sans, system-ui); font-size: 12px; padding: 6px 14px; border: 2px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; }
.cpub-topbar-btn:hover { background: var(--surface2); }
.cpub-topbar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-topbar-btn-primary { background: var(--accent); color: var(--color-text-inverse); font-weight: 600; box-shadow: 4px 4px 0 var(--border); }
.cpub-topbar-btn-primary:hover { box-shadow: 2px 2px 0 var(--border); }

.cpub-editor-error { padding: 10px 16px; background: var(--red-bg); color: var(--red); border-bottom: 2px solid var(--red); font-size: 12px; font-family: var(--font-mono); display: flex; align-items: center; gap: 8px; z-index: 99; }

.cpub-editor-shell { display: flex; flex: 1; overflow: hidden; }
.cpub-editor-canvas { flex: 1; overflow-y: auto; padding: 24px; background: var(--bg); }

.cpub-preview-canvas { flex: 1; overflow-y: auto; padding: 48px; max-width: 740px; margin: 0 auto; }
.cpub-preview-title { font-size: 28px; font-weight: 700; margin-bottom: 12px; line-height: 1.25; }
.cpub-preview-desc { font-size: 15px; color: var(--text-dim); margin-bottom: 32px; }
.cpub-preview-blocks { display: flex; flex-direction: column; gap: 16px; }

.cpub-code-canvas { flex: 1; overflow: auto; background: var(--text); padding: 16px; }
.cpub-code-view { color: var(--border2); font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; margin: 0; }

.cpub-hidden { display: none; }
</style>

<style>
/* Unscoped so Teleport overlay works */
.cpub-explainer-preview-overlay { position: fixed; inset: 0; z-index: 9999; background: var(--bg); overflow: hidden; }

.cpub-preview-close-btn {
  position: fixed; top: 10px; right: 16px; z-index: 10001;
  display: flex; align-items: center; gap: 6px; padding: 6px 14px;
  background: var(--surface); border: 2px solid var(--border); color: var(--text);
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  cursor: pointer; box-shadow: 4px 4px 0 var(--border); transition: box-shadow 0.1s, transform 0.1s;
}
.cpub-preview-close-btn:hover { box-shadow: 2px 2px 0 var(--border); transform: translate(1px, 1px); background: var(--surface2); }
.cpub-preview-close-btn i { font-size: 12px; }
</style>
