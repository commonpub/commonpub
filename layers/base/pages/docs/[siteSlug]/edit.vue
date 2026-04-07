<script setup lang="ts">
import type { BlockTuple } from '@commonpub/editor';
import { BlockCanvas, EditorShell, useBlockEditor, type BlockTypeGroup } from '@commonpub/editor/vue';
import type { PageTreeItem } from '../../../components/editors/DocsPageTree.vue';

definePageMeta({ layout: false, middleware: 'auth' });

const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);
const { show: toast } = useToast();

// ═══ DATA FETCHING ═══
const { data: site, refresh: refreshSite } = await useFetch<{ id: string; name: string; slug: string; description: string; ownerId: string; versions?: Array<{ id: string; version: string; isDefault: boolean }> }>(() => `/api/docs/${siteSlug.value}`);

// Version selector
const selectedVersion = ref('');
watch(site, (s) => {
  if (s?.versions?.length && !selectedVersion.value) {
    const def = s.versions.find((v) => v.isDefault) ?? s.versions[0];
    if (def) selectedVersion.value = def.version;
  }
}, { immediate: true });

const { data: rawPages, refresh: refreshPages } = await useFetch<Array<{ id: string; title: string; slug: string; sortOrder: number; parentId: string | null; content: string | BlockTuple[] | null; format?: string }>>(() => {
  const base = `/api/docs/${siteSlug.value}/pages`;
  return selectedVersion.value ? `${base}?version=${encodeURIComponent(selectedVersion.value)}` : base;
});

watch(selectedVersion, () => {
  selectedPageId.value = null;
  refreshPages();
});

useSeoMeta({ title: () => `Edit ${site.value?.name ?? 'Docs'} — ${useSiteName()}` });

interface DocsPage {
  id: string;
  title: string;
  slug: string;
  content: string | BlockTuple[];
  sortOrder: number;
  parentId: string | null;
}

const pages = computed<DocsPage[]>(() => (rawPages.value as DocsPage[]) ?? []);
const treePages = computed<PageTreeItem[]>(() =>
  pages.value.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    parentId: p.parentId,
    sortOrder: p.sortOrder,
  })),
);

// ═══ BLOCK EDITOR ═══
const blockEditor = useBlockEditor();

// Docs-specific block palette — no explainer/project blocks
const blockTypes: BlockTypeGroup[] = [
  {
    name: 'Text',
    blocks: [
      { type: 'paragraph', label: 'Paragraph', icon: 'fa-align-left', description: 'Body text' },
      { type: 'heading', label: 'Heading', icon: 'fa-heading', description: 'Section heading (H2-H4)' },
      { type: 'blockquote', label: 'Quote', icon: 'fa-quote-left', description: 'Blockquote with attribution' },
    ],
  },
  {
    name: 'Code & Media',
    blocks: [
      { type: 'code_block', label: 'Code Block', icon: 'fa-code', description: 'Syntax highlighted code' },
      { type: 'image', label: 'Image', icon: 'fa-image', description: 'Upload or embed image' },
      { type: 'embed', label: 'Embed', icon: 'fa-globe', description: 'External embed' },
    ],
  },
  {
    name: 'Layout',
    blocks: [
      { type: 'callout', label: 'Callout', icon: 'fa-circle-info', description: 'Info, tip, warning, or danger', attrs: { variant: 'info' } },
      { type: 'horizontal_rule', label: 'Divider', icon: 'fa-minus', description: 'Visual separator' },
    ],
  },
];

// ═══ PAGE SELECTION ═══
const selectedPageId = ref<string | null>(null);
const selectedPage = computed<DocsPage | null>(() =>
  pages.value.find(p => p.id === selectedPageId.value) ?? null,
);

// Page properties (right panel)
const pageSlug = ref('');
const pageStatus = ref<'draft' | 'published'>('draft');
const savingPage = ref(false);
const autoSaveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const autoSaveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const isDirty = ref(false);
const isLoadingPage = ref(false); // Guard: suppresses dirty-marking during page load
const markdownNotice = ref<string | null>(null); // Shows notice when markdown page is converted

// Load page content when selecting
async function selectPage(pageId: string): Promise<void> {
  // Save current page first if dirty
  if (isDirty.value && selectedPageId.value) {
    await saveCurrentPage();
  }

  selectedPageId.value = pageId;
  const page = pages.value.find(p => p.id === pageId);
  if (!page) return;

  // Guard: suppress dirty-marking during content load
  isLoadingPage.value = true;

  // Load content into block editor
  if (Array.isArray(page.content)) {
    blockEditor.fromBlockTuples(page.content as BlockTuple[]);
  } else if (typeof page.content === 'string' && page.content.trim()) {
    // Legacy markdown content — convert to blocks
    markdownNotice.value = page.title;
    blockEditor.clearBlocks();
    const { importMarkdown } = useMarkdownImport(blockEditor);
    await importMarkdown(page.content, 'replace');
  } else {
    blockEditor.clearBlocks();
    blockEditor.addBlock('paragraph');
  }

  // Load properties
  pageSlug.value = page.slug ?? '';
  pageStatus.value = ((page as unknown as Record<string, unknown>).status as 'draft' | 'published') || 'draft';
  isDirty.value = false;
  autoSaveStatus.value = 'idle';

  // Release guard after watchers have flushed
  await nextTick();
  isLoadingPage.value = false;
}

// ══�� SAVING ═══
async function saveCurrentPage(): Promise<void> {
  if (!selectedPageId.value) return;
  savingPage.value = true;
  autoSaveStatus.value = 'saving';

  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${selectedPageId.value}`, {
      method: 'PUT',
      body: {
        title: selectedPage.value?.title,
        slug: pageSlug.value,
        content: blockEditor.toBlockTuples(),
      },
    });
    isDirty.value = false;
    autoSaveStatus.value = 'saved';
    // Refresh pages list to keep tree in sync
    await refreshPages();
  } catch (err: unknown) {
    autoSaveStatus.value = 'error';
    toast(err instanceof Error ? err.message : 'Failed to save page', 'error');
  } finally {
    savingPage.value = false;
  }
}

// Autosave: debounce 5 seconds for docs (shorter than article 30s)
async function publishPage(): Promise<void> {
  if (!selectedPageId.value) return;
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${selectedPageId.value}`, {
      method: 'PUT',
      body: { status: 'published' },
    });
    pageStatus.value = 'published';
    await refreshPages();
    toast('Page published', 'success');
  } catch {
    toast('Failed to publish', 'error');
  }
}

async function unpublishPage(): Promise<void> {
  if (!selectedPageId.value) return;
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${selectedPageId.value}`, {
      method: 'PUT',
      body: { status: 'draft' },
    });
    pageStatus.value = 'draft';
    await refreshPages();
    toast('Page unpublished', 'success');
  } catch {
    toast('Failed to unpublish', 'error');
  }
}

function scheduleAutoSave(): void {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
  autoSaveTimer.value = setTimeout(() => {
    if (isDirty.value && selectedPageId.value) {
      saveCurrentPage();
    }
  }, 5000);
}

// Watch for changes — skip during page load to avoid false dirty
watch(() => blockEditor.blocks.value, () => {
  if (isLoadingPage.value) return;
  isDirty.value = true;
  scheduleAutoSave();
}, { deep: true });

watch(pageSlug, () => {
  if (isLoadingPage.value) return;
  isDirty.value = true;
  scheduleAutoSave();
});

// Keyboard shortcut: Cmd+S to save
function handleKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveCurrentPage();
  }
}

// Warn about unsaved changes on navigation
function handleBeforeUnload(e: BeforeUnloadEvent): void {
  if (isDirty.value) {
    e.preventDefault();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Auto-select page from ?page= query or first page
  const requestedPage = route.query.page as string | undefined;
  if (requestedPage && pages.value.length > 0) {
    const match = pages.value.find(p => p.slug === requestedPage || p.id === requestedPage);
    if (match) {
      selectPage(match.id);
      return;
    }
  }
  if (pages.value.length > 0 && !selectedPageId.value) {
    const first = [...pages.value].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    if (first) selectPage(first.id);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
});

// ═══ PAGE TREE ACTIONS ═══
const pendingReparent = ref(false);
async function handleCreatePage(parentId: string | null, title: string): Promise<void> {
  try {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const result = await $fetch(`/api/docs/${siteSlug.value}/pages`, {
      method: 'POST',
      body: {
        title,
        slug,
        content: [['paragraph', { html: '' }]],
        parentId: parentId ?? undefined,
        sortOrder: (pages.value?.length ?? 0) + 1,
      },
    });
    await refreshPages();
    if (result && typeof result === 'object' && 'id' in result) {
      selectPage((result as { id: string }).id);
    }
    toast('Page created', 'success');
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to create page', 'error');
  }
}

async function handleRenamePage(pageId: string, newTitle: string): Promise<void> {
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${pageId}`, {
      method: 'PUT',
      body: { title: newTitle },
    });
    await refreshPages();
    toast('Page renamed', 'success');
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to rename', 'error');
  }
}

async function handleDeletePage(pageId: string): Promise<void> {
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${pageId}`, { method: 'DELETE' });
    if (selectedPageId.value === pageId) {
      selectedPageId.value = null;
      blockEditor.clearBlocks();
    }
    await refreshPages();
    toast('Page deleted', 'success');
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to delete', 'error');
  }
}

async function handleReorder(pageIds: string[]): Promise<void> {
  pendingReparent.value = false; // Cancel reparent's deferred refresh
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/reorder`, {
      method: 'POST',
      body: { pageIds },
    });
    await refreshPages();
  } catch {
    toast('Failed to reorder', 'error');
  }
}

async function handleReparent(pageId: string, newParentId: string | null): Promise<void> {
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${pageId}`, {
      method: 'PUT',
      body: { parentId: newParentId ?? null },
    });
    // Don't refresh here — if reorder follows immediately, let reorder refresh
    // If reparent is standalone (drag inside), refresh
    pendingReparent.value = true;
    setTimeout(async () => {
      if (pendingReparent.value) {
        pendingReparent.value = false;
        await refreshPages();
      }
    }, 100);
  } catch {
    toast('Failed to move page', 'error');
  }
}


// ═══ PAGE TITLE EDITING ═══
const editingTitle = ref(false);
const editTitleValue = ref('');

function startEditTitle(): void {
  if (!selectedPage.value) return;
  editTitleValue.value = selectedPage.value.title;
  editingTitle.value = true;
  nextTick(() => {
    const input = document.querySelector('.cpub-docs-title-input') as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });
}

async function confirmEditTitle(): Promise<void> {
  if (!selectedPageId.value || !editTitleValue.value.trim()) {
    editingTitle.value = false;
    return;
  }
  await handleRenamePage(selectedPageId.value, editTitleValue.value.trim());
  editingTitle.value = false;
}

// ═══ WORD COUNT ═══
const wordCount = computed(() => {
  let count = 0;
  for (const block of blockEditor.blocks.value) {
    const html = (block.content.html as string) || (block.content.text as string) || (block.content.code as string) || '';
    count += html.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  }
  return count;
});

// ═��═ MARKDOWN IMPORT ═══
const showImportDialog = ref(false);

function handleMarkdownImport(md: string, mode: 'append' | 'replace'): void {
  const { importMarkdown } = useMarkdownImport(blockEditor);
  importMarkdown(md, mode);
  showImportDialog.value = false;
  isDirty.value = true;
  scheduleAutoSave();
}

// ═══ SITE SETTINGS ═══
const showSettings = ref(false);
const settingsName = ref('');
const settingsDesc = ref('');
const savingSettings = ref(false);
const newVersion = ref('');
const newVersionDefault = ref(false);
const savingVersion = ref(false);

interface DocsSiteVersion {
  id: string;
  version: string;
  isDefault: boolean;
}

watch(site, (s) => {
  if (!s) return;
  settingsName.value = (s as Record<string, unknown>).name as string ?? '';
  settingsDesc.value = (s as Record<string, unknown>).description as string ?? '';
}, { immediate: true });

async function saveSiteSettings(): Promise<void> {
  savingSettings.value = true;
  try {
    await $fetch(`/api/docs/${siteSlug.value}`, {
      method: 'PUT',
      body: { name: settingsName.value, description: settingsDesc.value },
    });
    toast('Site settings updated', 'success');
    await refreshSite();
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to update settings', 'error');
  } finally {
    savingSettings.value = false;
  }
}

async function deleteSite(): Promise<void> {
  if (!confirm('Delete this entire docs site? All pages and versions will be permanently deleted.')) return;
  try {
    await $fetch(`/api/docs/${siteSlug.value}`, { method: 'DELETE' });
    toast('Docs site deleted', 'success');
    await navigateTo('/docs');
  } catch {
    toast('Failed to delete docs site', 'error');
  }
}

async function createVersion(): Promise<void> {
  if (!newVersion.value.trim()) return;
  savingVersion.value = true;
  try {
    await $fetch(`/api/docs/${siteSlug.value}/versions`, {
      method: 'POST',
      body: { version: newVersion.value, isDefault: newVersionDefault.value },
    });
    toast('Version created', 'success');
    newVersion.value = '';
    newVersionDefault.value = false;
    await refreshSite();
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to create version', 'error');
  } finally {
    savingVersion.value = false;
  }
}
</script>

<template>
  <div class="cpub-docs-editor">
    <!-- Top bar -->
    <div class="cpub-docs-topbar">
      <NuxtLink :to="`/docs/${siteSlug}`" class="cpub-docs-back" aria-label="Back to docs">
        <i class="fa-solid fa-arrow-left" />
      </NuxtLink>
      <span class="cpub-docs-topbar-title">{{ site?.name ?? 'Docs' }}</span>
      <div class="cpub-docs-topbar-spacer" />
      <button
        v-if="selectedPageId"
        class="cpub-docs-toolbar-btn"
        title="Import Markdown"
        @click="showImportDialog = true"
      >
        <i class="fa-brands fa-markdown" />
      </button>
      <button class="cpub-docs-toolbar-btn" title="Site Settings" @click="showSettings = true">
        <i class="fa-solid fa-gear" />
      </button>
      <button
        class="cpub-docs-toolbar-btn"
        :class="{ 'cpub-docs-toolbar-btn-saving': savingPage }"
        :disabled="!isDirty || savingPage"
        @click="saveCurrentPage"
      >
        <i class="fa-solid" :class="savingPage ? 'fa-spinner fa-spin' : 'fa-floppy-disk'" />
        <span>{{ savingPage ? 'Saving' : isDirty ? 'Save' : 'Saved' }}</span>
      </button>
    </div>

    <!-- 3-panel editor -->
    <EditorShell :show-left-sidebar="true" :show-right-sidebar="!!selectedPageId">
      <!-- LEFT: Page tree -->
      <template #left>
        <div class="cpub-docs-left-header">
          <span class="cpub-docs-left-label">Pages</span>
          <span class="cpub-docs-page-count">{{ pages.length }}</span>
        </div>
        <div v-if="site?.versions && site.versions.length > 1" class="cpub-docs-version-select">
          <select v-model="selectedVersion" class="cpub-docs-version-dropdown" aria-label="Select version">
            <option v-for="v in site.versions" :key="v.id" :value="v.version">
              {{ v.version }}{{ v.isDefault ? ' (latest)' : '' }}
            </option>
          </select>
        </div>
        <EditorsDocsPageTree
          :pages="treePages"
          :selected-page-id="selectedPageId"
          @select="selectPage"
          @create="handleCreatePage"
          @rename="handleRenamePage"
          @delete="handleDeletePage"
          @reorder="handleReorder"
          @reparent="handleReparent"
        />
      </template>

      <!-- CENTER: Block editor -->
      <template #default>
        <div v-if="selectedPage" class="cpub-docs-center">
          <!-- Page title -->
          <div class="cpub-docs-title-area">
            <input
              v-if="editingTitle"
              v-model="editTitleValue"
              class="cpub-docs-title-input"
              @keydown.enter="confirmEditTitle"
              @keydown.escape="editingTitle = false"
              @blur="confirmEditTitle"
            />
            <h1 v-else class="cpub-docs-title" @click="startEditTitle">
              {{ selectedPage.title || 'Untitled Page' }}
            </h1>
          </div>

          <!-- Markdown conversion notice -->
          <div v-if="markdownNotice" class="cpub-docs-notice">
            <i class="fa-solid fa-circle-info" />
            <span>"{{ markdownNotice }}" was converted from markdown to blocks. Saving will store the block format.</span>
            <button class="cpub-docs-notice-dismiss" @click="markdownNotice = null" aria-label="Dismiss">
              <i class="fa-solid fa-xmark" />
            </button>
          </div>

          <!-- Block canvas -->
          <BlockCanvas
            :block-editor="blockEditor"
            :block-types="blockTypes"
          />
        </div>

        <!-- Empty state -->
        <div v-else class="cpub-docs-empty">
          <i class="fa-solid fa-file-lines cpub-docs-empty-icon" />
          <p class="cpub-docs-empty-text">Select a page from the sidebar or create a new one.</p>
        </div>
      </template>

      <!-- RIGHT: Blocks + Properties -->
      <template #right>
        <div v-if="selectedPage" class="cpub-docs-right">
          <!-- Block palette -->
          <div class="cpub-docs-right-section">
            <h3 class="cpub-docs-props-heading">Blocks</h3>
            <div class="cpub-docs-block-list">
              <template v-for="group in blockTypes" :key="group.name">
                <button
                  v-for="block in group.blocks"
                  :key="block.type + (block.attrs?.variant || '')"
                  class="cpub-docs-block-btn"
                  @click="blockEditor.addBlock(block.type, block.attrs)"
                >
                  <i :class="`fa-solid ${block.icon}`" class="cpub-docs-block-icon" />
                  <span>{{ block.label }}</span>
                </button>
              </template>
            </div>
          </div>

          <!-- Page properties -->
          <div class="cpub-docs-right-section">
            <h3 class="cpub-docs-props-heading">Properties</h3>

            <div class="cpub-docs-field">
              <label class="cpub-docs-field-label">Slug</label>
              <input v-model="pageSlug" class="cpub-docs-field-input" placeholder="page-slug" />
            </div>

            <div class="cpub-docs-field">
              <label class="cpub-docs-field-label">Status</label>
              <div class="cpub-docs-status-row">
                <span class="cpub-docs-status-badge" :class="pageStatus === 'published' ? 'cpub-docs-status-published' : 'cpub-docs-status-draft'">
                  {{ pageStatus === 'published' ? 'Published' : 'Draft' }}
                </span>
                <button
                  v-if="pageStatus !== 'published'"
                  class="cpub-docs-publish-btn"
                  @click="publishPage"
                >
                  <i class="fa-solid fa-globe" /> Publish
                </button>
                <button
                  v-else
                  class="cpub-docs-unpublish-btn"
                  @click="unpublishPage"
                >
                  Unpublish
                </button>
              </div>
            </div>

            <div class="cpub-docs-field">
              <label class="cpub-docs-field-label">Parent</label>
              <div class="cpub-docs-field-value">
                {{ selectedPage?.parentId ? pages.find(p => p.id === selectedPage!.parentId)?.title ?? 'Unknown' : 'Top level' }}
              </div>
              <span class="cpub-docs-field-hint">Drag pages in the tree to change hierarchy</span>
            </div>
          </div>
        </div>
      </template>

      <!-- STATUS BAR -->
      <template #status>
        <span class="cpub-docs-stat">
          <span class="cpub-docs-stat-label">Pages:</span>
          <span class="cpub-docs-stat-value">{{ pages.length }}</span>
        </span>
        <span v-if="selectedPageId" class="cpub-docs-stat">
          <span class="cpub-docs-stat-label">Words:</span>
          <span class="cpub-docs-stat-value">{{ wordCount }}</span>
        </span>
        <span v-if="selectedPageId" class="cpub-docs-stat">
          <span class="cpub-docs-stat-label">Blocks:</span>
          <span class="cpub-docs-stat-value">{{ blockEditor.blocks.value.length }}</span>
        </span>
        <div style="flex: 1" />
        <span class="cpub-docs-stat">
          <span
            class="cpub-docs-save-dot"
            :class="{
              'cpub-docs-save-dot-clean': !isDirty && autoSaveStatus !== 'error',
              'cpub-docs-save-dot-dirty': isDirty,
              'cpub-docs-save-dot-error': autoSaveStatus === 'error',
            }"
          />
          <span class="cpub-docs-stat-label">
            {{ autoSaveStatus === 'saving' ? 'Saving...' : autoSaveStatus === 'error' ? 'Save failed' : isDirty ? 'Unsaved changes' : 'All saved' }}
          </span>
        </span>
      </template>
    </EditorShell>

    <!-- Markdown import dialog -->
    <EditorsMarkdownImportDialog
      :show="showImportDialog"
      @close="showImportDialog = false"
      @import="handleMarkdownImport"
    />

    <!-- Site settings panel -->
    <Teleport to="body">
      <div v-if="showSettings" class="cpub-settings-overlay" @click.self="showSettings = false">
        <div class="cpub-settings-panel">
          <div class="cpub-settings-header">
            <h2 class="cpub-settings-title"><i class="fa-solid fa-gear" /> Site Settings</h2>
            <button class="cpub-settings-close" @click="showSettings = false" aria-label="Close settings">
              <i class="fa-solid fa-xmark" />
            </button>
          </div>

          <div class="cpub-settings-body">
            <!-- Site info -->
            <section class="cpub-settings-section">
              <h3 class="cpub-settings-section-title">General</h3>
              <div class="cpub-settings-field">
                <label class="cpub-settings-label">Site Name</label>
                <input v-model="settingsName" class="cpub-settings-input" />
              </div>
              <div class="cpub-settings-field">
                <label class="cpub-settings-label">Description</label>
                <textarea v-model="settingsDesc" class="cpub-settings-textarea" rows="3" />
              </div>
              <button class="cpub-btn cpub-btn-sm" :disabled="savingSettings" @click="saveSiteSettings">
                {{ savingSettings ? 'Saving...' : 'Save Settings' }}
              </button>
            </section>

            <!-- Versions -->
            <section class="cpub-settings-section">
              <h3 class="cpub-settings-section-title">Versions</h3>
              <div v-if="(site as any)?.versions?.length" class="cpub-settings-versions">
                <div
                  v-for="v in ((site as any).versions as DocsSiteVersion[])"
                  :key="v.id"
                  class="cpub-settings-version-item"
                >
                  <span class="cpub-settings-version-label">{{ v.version }}</span>
                  <span v-if="v.isDefault" class="cpub-settings-version-badge">default</span>
                </div>
              </div>
              <div class="cpub-settings-field" style="margin-top: 10px;">
                <label class="cpub-settings-label">New Version</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <input v-model="newVersion" class="cpub-settings-input" placeholder="e.g. 2.0" style="flex: 1;" />
                  <label class="cpub-settings-checkbox">
                    <input type="checkbox" v-model="newVersionDefault" /> Default
                  </label>
                  <button class="cpub-btn cpub-btn-sm" :disabled="savingVersion || !newVersion.trim()" @click="createVersion">
                    {{ savingVersion ? 'Creating...' : 'Create' }}
                  </button>
                </div>
              </div>
            </section>

            <!-- Danger zone -->
            <section class="cpub-settings-section cpub-settings-danger">
              <h3 class="cpub-settings-section-title">Danger Zone</h3>
              <p class="cpub-settings-danger-text">Permanently delete this docs site and all its pages.</p>
              <button class="cpub-btn cpub-btn-sm cpub-btn-danger" @click="deleteSite">
                <i class="fa-solid fa-trash" /> Delete Site
              </button>
            </section>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cpub-docs-editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
}

/* Top bar */
.cpub-docs-topbar {
  height: 44px;
  flex-shrink: 0;
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 10px;
}

.cpub-docs-back {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  text-decoration: none;
  font-size: 12px;
}

.cpub-docs-back:hover {
  color: var(--text);
}

.cpub-docs-topbar-title {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.04em;
}

.cpub-docs-topbar-spacer {
  flex: 1;
}

.cpub-docs-toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
}

.cpub-docs-toolbar-btn:hover {
  background: var(--surface);
  color: var(--text);
  border-color: var(--accent);
}

.cpub-docs-toolbar-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Left panel header */
.cpub-docs-left-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 8px;
  border-bottom: var(--border-width-default) solid var(--border2);
  margin-bottom: 4px;
}

.cpub-docs-left-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
}

.cpub-docs-version-select {
  padding: 4px 0 6px;
}
.cpub-docs-version-dropdown {
  width: 100%;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 6px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border2);
  color: var(--text);
  cursor: pointer;
}

.cpub-docs-page-count {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-faint);
  background: var(--surface2);
  padding: 1px 6px;
  border: var(--border-width-default) solid var(--border2);
}

/* Center: editor */
.cpub-docs-center {
  max-width: 740px;
  margin: 0 auto;
  width: 100%;
}

.cpub-docs-title-area {
  margin-bottom: 8px;
}

.cpub-docs-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  cursor: text;
  padding: 4px 0;
  border-bottom: 2px solid transparent;
  transition: border-color 0.15s;
}

.cpub-docs-title:hover {
  border-bottom-color: var(--border2);
}

.cpub-docs-title-input {
  width: 100%;
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  background: none;
  border: none;
  border-bottom: 2px solid var(--accent);
  padding: 4px 0;
  outline: none;
  font-family: inherit;
}

/* Empty state */
.cpub-docs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-faint);
}

.cpub-docs-empty-icon {
  font-size: 32px;
  opacity: 0.3;
}

.cpub-docs-empty-text {
  font-size: 13px;
}

/* Right panel: properties */
.cpub-docs-props {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cpub-docs-props-heading {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  padding-bottom: 8px;
  border-bottom: var(--border-width-default) solid var(--border2);
}

.cpub-docs-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cpub-docs-field-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.cpub-docs-field-input {
  padding: 6px 8px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-family: var(--font-mono);
}

.cpub-docs-field-input:focus {
  border-color: var(--accent);
  outline: none;
}

.cpub-docs-field-hint {
  font-size: 10px;
  color: var(--text-faint);
  line-height: 1.3;
}

/* Right panel layout */
.cpub-docs-right {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cpub-docs-right-section {
  padding: 12px 0;
  border-bottom: var(--border-width-default) solid var(--border2);
}

.cpub-docs-right-section:last-child {
  border-bottom: none;
}

/* Block palette */
.cpub-docs-block-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cpub-docs-block-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.cpub-docs-block-btn:hover {
  background: var(--surface2);
  border-color: var(--border);
  color: var(--text);
}

.cpub-docs-block-icon {
  width: 14px;
  font-size: 10px;
  color: var(--text-faint);
  text-align: center;
}

/* Status badge + publish */
.cpub-docs-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-docs-status-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
}

.cpub-docs-status-draft {
  color: var(--yellow, #d4a017);
  background: var(--yellow-bg, rgba(245, 158, 11, 0.08));
  border: var(--border-width-default) solid var(--yellow-border, rgba(245, 158, 11, 0.25));
}

.cpub-docs-status-published {
  color: var(--green, #2a9d5c);
  background: var(--green-bg, rgba(34, 197, 94, 0.08));
  border: var(--border-width-default) solid var(--green-border, rgba(34, 197, 94, 0.25));
}

.cpub-docs-publish-btn {
  padding: 3px 10px;
  background: var(--accent);
  border: var(--border-width-default) solid var(--accent);
  color: var(--color-text-inverse, #fff);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.cpub-docs-publish-btn:hover {
  opacity: 0.85;
}

.cpub-docs-unpublish-btn {
  padding: 3px 10px;
  background: none;
  border: var(--border-width-default) solid var(--border);
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  cursor: pointer;
}

.cpub-docs-unpublish-btn:hover {
  color: var(--yellow, #d4a017);
  border-color: var(--yellow, #d4a017);
}

.cpub-docs-field-value {
  font-size: 12px;
  color: var(--text-dim);
  padding: 6px 0;
}

/* Markdown conversion notice */
.cpub-docs-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent-border);
  font-size: 12px;
  color: var(--text-dim);
}

.cpub-docs-notice i:first-child {
  color: var(--accent);
  font-size: 13px;
  flex-shrink: 0;
}

.cpub-docs-notice-dismiss {
  margin-left: auto;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  flex-shrink: 0;
}

.cpub-docs-notice-dismiss:hover {
  color: var(--text);
}

/* Status bar stats */
.cpub-docs-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cpub-docs-stat-label {
  text-transform: uppercase;
  color: var(--text-faint);
}

.cpub-docs-stat-value {
  color: var(--text-dim);
}

.cpub-docs-save-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.cpub-docs-save-dot-clean {
  background: var(--green, #2a9d5c);
}

.cpub-docs-save-dot-dirty {
  background: var(--yellow, #d4a017);
}

.cpub-docs-save-dot-error {
  background: var(--red, #e04030);
}

/* Settings panel */
.cpub-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
}

.cpub-settings-panel {
  width: 480px;
  max-height: 80vh;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  box-shadow: var(--shadow-xl, 8px 8px 0 var(--border));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cpub-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-settings-title {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cpub-settings-title i {
  color: var(--accent);
  font-size: 11px;
}

.cpub-settings-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: var(--border-width-default) solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 13px;
}

.cpub-settings-close:hover {
  background: var(--surface2);
  border-color: var(--border);
}

.cpub-settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.cpub-settings-section {
  padding: 16px 20px;
  border-bottom: var(--border-width-default) solid var(--border);
}

.cpub-settings-section:last-child {
  border-bottom: none;
}

.cpub-settings-section-title {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-faint);
  margin-bottom: 12px;
}

.cpub-settings-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.cpub-settings-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

.cpub-settings-input {
  padding: 6px 10px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-size: 13px;
}

.cpub-settings-input:focus {
  border-color: var(--accent);
  outline: none;
}

.cpub-settings-textarea {
  padding: 6px 10px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.cpub-settings-textarea:focus {
  border-color: var(--accent);
  outline: none;
}

.cpub-settings-versions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cpub-settings-version-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border);
  font-family: var(--font-mono);
  font-size: 11px;
}

.cpub-settings-version-label {
  font-weight: 600;
}

.cpub-settings-version-badge {
  font-size: 9px;
  padding: 1px 5px;
  background: var(--accent-bg);
  color: var(--accent);
  border: var(--border-width-default) solid var(--accent-border);
}

.cpub-settings-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
}

.cpub-settings-checkbox input {
  accent-color: var(--accent);
}

.cpub-settings-danger {
  background: rgba(224, 64, 48, 0.03);
}

.cpub-settings-danger .cpub-settings-section-title {
  color: var(--red, #e04030);
}

.cpub-settings-danger-text {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 10px;
}

.cpub-btn-danger {
  color: var(--red, #e04030);
  border-color: var(--red, #e04030);
}

.cpub-btn-danger:hover {
  background: var(--red, #e04030);
  color: var(--color-text-inverse, #fff);
}
</style>
