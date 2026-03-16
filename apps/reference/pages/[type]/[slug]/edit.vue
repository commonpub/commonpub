<script setup lang="ts">
import type { BlockTuple } from '@commonpub/editor';
import type { Component } from 'vue';

definePageMeta({ layout: false, middleware: 'auth' });

const route = useRoute();
const contentType = computed(() => route.params.type as string);
const slug = computed(() => route.params.slug as string);
const isNew = computed(() => slug.value === 'new');

useSeoMeta({
  title: () => isNew.value ? `New ${contentType.value} — CommonPub` : `Edit — CommonPub`,
});

const { user } = useAuth();

const title = ref('');
const blocks = ref<BlockTuple[]>([]);
const metadata = ref<Record<string, unknown>>({
  description: '',
  slug: '',
  tags: [],
  visibility: 'public',
  coverImage: '',
});
const selectedBlock = ref<{ type: string; attrs: Record<string, unknown> } | null>(null);
const saving = ref(false);
const error = ref('');
const isDirty = ref(false);
const mode = ref<'write' | 'preview' | 'code'>('write');

const editorRef = ref<InstanceType<typeof CpubEditor> | null>(null);
const contentId = ref<string | null>(null);

// Specialized editor component map — Nuxt prefixes with directory name
const editorMap: Record<string, Component> = {
  article: resolveComponent('EditorsArticleEditor') as Component,
  blog: resolveComponent('EditorsBlogEditor') as Component,
  explainer: resolveComponent('EditorsExplainerEditor') as Component,
  project: resolveComponent('EditorsProjectEditor') as Component,
};

const editorComponent = computed<Component | null>(() => {
  return editorMap[contentType.value] ?? null;
});

const hasSpecializedEditor = computed(() => editorComponent.value !== null);

// Load existing content for editing
if (!isNew.value) {
  const { data } = await useFetch(() => `/api/content/${slug.value}`);
  if (data.value) {
    const d = data.value as Record<string, unknown>;
    contentId.value = d.id as string;
    title.value = d.title as string;
    if (Array.isArray(d.content)) {
      blocks.value = d.content as BlockTuple[];
    }
    // Load all metadata fields from server response
    metadata.value = {
      description: (d.description as string) || '',
      slug: (d.slug as string) || '',
      tags: d.tags ? (d.tags as { name: string }[]).map((t) => t.name) : [],
      visibility: (d.visibility as string) || 'public',
      coverImage: (d.coverImageUrl as string) || '',
      coverImageUrl: (d.coverImageUrl as string) || '',
      seoDescription: (d.seoDescription as string) || '',
      difficulty: (d.difficulty as string) || '',
      buildTime: (d.buildTime as string) || '',
      estimatedCost: (d.estimatedCost as string) || '',
      category: (d.category as string) || '',
      subtitle: (d.subtitle as string) || '',
    };
  }
}

function handleBlocksUpdate(newBlocks: BlockTuple[]): void {
  blocks.value = newBlocks;
  isDirty.value = true;
}

function handleMetadataUpdate(newMetadata: Record<string, unknown>): void {
  metadata.value = newMetadata;
  isDirty.value = true;
}

function handleSelectionChange(node: { type: string; attrs: Record<string, unknown> } | null): void {
  selectedBlock.value = node;
}

async function handleSave(): Promise<void> {
  saving.value = true;
  error.value = '';

  try {
    // Spread all metadata so type-specific fields (slug, costMin, costMax,
    // series, excerpt, ogImage, estimatedMinutes, learningObjectives, etc.)
    // are never silently dropped by the save.
    const body: Record<string, unknown> = {
      type: contentType.value,
      title: title.value,
      content: blocks.value,
      ...metadata.value,
      // Map coverImage → coverImageUrl to match the server field name
      coverImageUrl: metadata.value.coverImage || metadata.value.coverImageUrl,
    };
    // Remove the client-only coverImage alias to avoid confusion
    delete body.coverImage;

    if (isNew.value) {
      const result = await $fetch<{ id: string; slug: string }>('/api/content', { method: 'POST', body });
      contentId.value = result.id;
      isDirty.value = false;
      await navigateTo(`/${contentType.value}/${result.slug}`);
    } else {
      await $fetch(`/api/content/${contentId.value}`, { method: 'PUT', body });
      isDirty.value = false;
      await navigateTo(`/${contentType.value}/${slug.value}`);
    }
  } catch (err: unknown) {
    error.value = (err as { data?: { message?: string } })?.data?.message || 'Failed to save.';
  } finally {
    saving.value = false;
  }
}

async function handlePublish(): Promise<void> {
  await handleSave();
  if (!error.value && contentId.value) {
    try {
      await $fetch(`/api/content/${contentId.value}/publish`, { method: 'POST' });
    } catch (err: unknown) {
      error.value = (err as { data?: { message?: string } })?.data?.message || 'Failed to publish.';
    }
  }
}
</script>

<template>
  <div class="cpub-editor-layout">
    <!-- Top bar -->
    <header class="cpub-editor-topbar">
      <NuxtLink to="/" class="cpub-editor-logo" aria-label="Home">
        <span class="cpub-logo-accent">[</span>cpub<span class="cpub-logo-accent">]</span>
      </NuxtLink>
      <button class="cpub-editor-back" aria-label="Go back" @click="$router.back()"><i class="fa-solid fa-arrow-left"></i></button>
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
      </div>
      <div class="cpub-mode-tabs">
        <button :class="['cpub-mode-tab', { active: mode === 'write' }]" @click="mode = 'write'">Write</button>
        <button :class="['cpub-mode-tab', { active: mode === 'preview' }]" @click="mode = 'preview'">Preview</button>
        <button :class="['cpub-mode-tab', { active: mode === 'code' }]" @click="mode = 'code'">Code</button>
      </div>
      <div class="cpub-topbar-spacer" />
      <div class="cpub-topbar-actions">
        <button class="cpub-topbar-btn" :disabled="saving || !title" @click="handleSave">
          {{ saving ? 'Saving...' : 'Save Draft' }}
        </button>
        <button class="cpub-topbar-btn cpub-topbar-btn-primary" :disabled="saving || !title" @click="handlePublish">
          Publish
        </button>
      </div>
    </header>

    <div v-if="error" class="cpub-editor-error" role="alert">{{ error }}</div>

    <!-- Specialized editor via dynamic component -->
    <template v-if="mode === 'write' && hasSpecializedEditor">
      <component
        :is="editorComponent"
        :blocks="blocks"
        :metadata="metadata"
        :editor-ref="editorRef"
        @update:blocks="handleBlocksUpdate"
        @update:metadata="handleMetadataUpdate"
      >
        <ClientOnly>
          <CpubEditor
            ref="editorRef"
            :model-value="blocks"
            :editable="true"
            @update:model-value="handleBlocksUpdate"
            @selection-change="handleSelectionChange"
          />
        </ClientOnly>
      </component>
    </template>

    <!-- Fallback: generic inline editor for unknown content types -->
    <div v-else-if="mode === 'write'" class="cpub-editor-shell">
      <EditorBlockLibrary :content-type="contentType" :editor="(editorRef as any)?.editor" />
      <div class="cpub-editor-canvas">
        <EditorToolbar :editor="(editorRef as any)?.editor" />
        <ClientOnly>
          <CpubEditor
            ref="editorRef"
            :model-value="blocks"
            :editable="true"
            @update:model-value="handleBlocksUpdate"
            @selection-change="handleSelectionChange"
          />
        </ClientOnly>
      </div>
      <EditorPropertiesPanel
        :content-type="contentType"
        :metadata="metadata"
        :selected-block="selectedBlock"
        @update:metadata="handleMetadataUpdate"
      />
    </div>

    <!-- Preview mode -->
    <div v-else-if="mode === 'preview'" class="cpub-editor-shell">
      <div class="cpub-preview-canvas">
        <h1 class="cpub-preview-title">{{ title || 'Untitled' }}</h1>
        <p v-if="metadata.description" class="cpub-preview-desc">{{ metadata.description }}</p>
        <ClientOnly>
          <CpubEditor :model-value="blocks" :editable="false" />
        </ClientOnly>
      </div>
    </div>

    <!-- Code mode -->
    <div v-else class="cpub-editor-shell">
      <div class="cpub-code-canvas">
        <pre class="cpub-code-view">{{ JSON.stringify(blocks, null, 2) }}</pre>
      </div>
    </div>
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
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-4);
  gap: 0;
  flex-shrink: 0;
  z-index: var(--z-sticky);
}

.cpub-editor-logo {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  color: var(--text-dim);
  letter-spacing: 0.06em;
  text-decoration: none;
  flex-shrink: 0;
}
.cpub-logo-accent { color: var(--accent); }

.cpub-editor-back {
  width: 30px; height: 30px;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: var(--text-xs);
  margin-left: var(--space-2);
  flex-shrink: 0;
}
.cpub-editor-back:hover { background: var(--surface2); border-color: var(--border2); color: var(--text); }
.cpub-editor-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.cpub-topbar-divider {
  width: 2px; height: 22px;
  background: var(--border);
  margin: 0 var(--space-3);
  flex-shrink: 0;
}

.cpub-topbar-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.cpub-topbar-title-input {
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text);
  background: none;
  border: var(--border-width-default) solid transparent;
  padding: 4px 8px;
  cursor: text;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 380px;
  outline: none;
  font-family: var(--font-sans);
}
.cpub-topbar-title-input:hover { border-color: var(--border2); background: var(--surface2); }
.cpub-topbar-title-input:focus { border-color: var(--accent); background: var(--surface2); }

.cpub-unsaved-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--yellow);
  flex-shrink: 0;
}

.cpub-mode-tabs {
  display: flex;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  padding: 2px;
  flex-shrink: 0;
  margin: 0 var(--space-3);
}
.cpub-mode-tab {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 5px 14px;
  border: none;
  background: none;
  color: var(--text-dim);
  cursor: pointer;
}
.cpub-mode-tab.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
.cpub-mode-tab:hover:not(.active) { color: var(--text); }

.cpub-topbar-spacer { flex: 1; }

.cpub-topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.cpub-topbar-btn {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  padding: 6px 14px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.cpub-topbar-btn:hover { background: var(--surface2); }
.cpub-topbar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-topbar-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.cpub-topbar-btn-primary {
  background: var(--accent);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-md);
}
.cpub-topbar-btn-primary:hover { background: var(--color-primary-hover); }

.cpub-editor-error {
  padding: var(--space-3);
  background: var(--red-bg);
  color: var(--red);
  border-bottom: 1px solid var(--red-border);
  font-size: var(--text-sm);
}

.cpub-editor-shell {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.cpub-editor-canvas {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
  background: var(--bg);
}

.cpub-preview-canvas {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-8);
  max-width: var(--content-max-width);
  margin: 0 auto;
}
.cpub-preview-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-3);
  line-height: var(--leading-tight);
}
.cpub-preview-desc {
  font-size: var(--text-md);
  color: var(--text-dim);
  margin-bottom: var(--space-6);
}

.cpub-code-canvas {
  flex: 1;
  overflow: auto;
  background: var(--text);
  padding: var(--space-4);
}
.cpub-code-view {
  color: var(--border2);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  white-space: pre-wrap;
  margin: 0;
}
</style>
