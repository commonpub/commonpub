<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);

const { data: site, refresh: refreshSite } = useLazyFetch(() => `/api/docs/${siteSlug.value}`);
const { data: pages, refresh: refreshPages } = useLazyFetch(() => `/api/docs/${siteSlug.value}/pages`);

useSeoMeta({ title: () => `Edit ${site.value?.name ?? 'Docs'} — ${useSiteName()}` });

const { show: toast } = useToast();

// ═══ SITE SETTINGS ═══
const editSiteName = ref('');
const editSiteDesc = ref('');
const savingSite = ref(false);

watch(site, (s) => {
  if (!s) return;
  editSiteName.value = s.name ?? '';
  editSiteDesc.value = s.description ?? '';
}, { immediate: true });

async function saveSiteSettings(): Promise<void> {
  savingSite.value = true;
  try {
    await $fetch(`/api/docs/${siteSlug.value}`, {
      method: 'PUT',
      body: { name: editSiteName.value, description: editSiteDesc.value },
    });
    toast('Site settings updated', 'success');
    await refreshSite();
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to update', 'error');
  } finally {
    savingSite.value = false;
  }
}

// ═══ PAGE CREATION ═══
const showNewPage = ref(false);
const newPageTitle = ref('');
const newPageSlug = ref('');
const newPageContent = ref('');
const newPageParentId = ref<string | null>(null);
const savingPage = ref(false);

function autoSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

watch(newPageTitle, (t) => {
  if (!newPageSlug.value || newPageSlug.value === autoSlug(newPageTitle.value.slice(0, -1))) {
    newPageSlug.value = autoSlug(t);
  }
});

async function createPage(): Promise<void> {
  if (!newPageTitle.value.trim()) return;
  savingPage.value = true;
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages`, {
      method: 'POST',
      body: {
        title: newPageTitle.value,
        slug: newPageSlug.value || autoSlug(newPageTitle.value),
        content: newPageContent.value,
        parentId: newPageParentId.value || undefined,
        sortOrder: (pages.value?.length ?? 0) + 1,
      },
    });
    toast('Page created', 'success');
    newPageTitle.value = '';
    newPageSlug.value = '';
    newPageContent.value = '';
    newPageParentId.value = null;
    showNewPage.value = false;
    await refreshPages();
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to create page', 'error');
  } finally {
    savingPage.value = false;
  }
}

// ═══ DELETE SITE ═══
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

// ═══ VERSION CREATION ═══
const showNewVersion = ref(false);
const newVersion = ref('');
const newVersionDefault = ref(false);
const savingVersion = ref(false);

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
    showNewVersion.value = false;
    await refreshSite();
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to create version', 'error');
  } finally {
    savingVersion.value = false;
  }
}

// ═══ PAGE EDITING ═══
interface DocsPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  sortOrder: number;
  parentId: string | null;
}

const editingPageId = ref<string | null>(null);
const editPageContent = ref('');
const editPageTitle = ref('');
const editPageParentId = ref<string | null>(null);
const savingEdit = ref(false);
const showPreview = ref(false);

function startEditPage(page: DocsPage): void {
  editingPageId.value = page.id;
  editPageTitle.value = page.title;
  editPageContent.value = page.content ?? '';
  editPageParentId.value = page.parentId;
  showPreview.value = false;
}

async function savePageEdit(): Promise<void> {
  if (!editingPageId.value) return;
  savingEdit.value = true;
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${editingPageId.value}`, {
      method: 'PUT',
      body: {
        title: editPageTitle.value,
        content: editPageContent.value,
        parentId: editPageParentId.value || undefined,
      },
    });
    toast('Page updated', 'success');
    editingPageId.value = null;
    await refreshPages();
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to update page', 'error');
  } finally {
    savingEdit.value = false;
  }
}

// ═══ PAGE DELETION ═══
async function deletePage(pageId: string): Promise<void> {
  if (!confirm('Delete this page? This cannot be undone.')) return;
  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/${pageId}`, { method: 'DELETE' });
    toast('Page deleted', 'success');
    if (editingPageId.value === pageId) editingPageId.value = null;
    await refreshPages();
  } catch {
    toast('Failed to delete page', 'error');
  }
}

// ═══ PAGE REORDERING ═══
async function movePage(pageId: string, direction: 'up' | 'down'): Promise<void> {
  if (!pages.value) return;
  const allPages = [...(pages.value as DocsPage[])].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = allPages.findIndex(p => p.id === pageId);
  if (idx === -1) return;
  if (direction === 'up' && idx === 0) return;
  if (direction === 'down' && idx === allPages.length - 1) return;

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  [allPages[idx], allPages[swapIdx]] = [allPages[swapIdx]!, allPages[idx]!];

  try {
    await $fetch(`/api/docs/${siteSlug.value}/pages/reorder`, {
      method: 'POST',
      body: { pageIds: allPages.map(p => p.id) },
    });
    await refreshPages();
  } catch {
    toast('Failed to reorder', 'error');
  }
}

// ═══ MARKDOWN TOOLBAR ═══
function insertMarkdown(textarea: HTMLTextAreaElement | null, before: string, after: string = ''): void {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const replacement = before + (selected || 'text') + after;
  textarea.setRangeText(replacement, start, end, 'select');
  textarea.focus();

  // Update the reactive value
  if (editingPageId.value) {
    editPageContent.value = textarea.value;
  } else {
    newPageContent.value = textarea.value;
  }
}

// Template refs for markdown toolbar
const newContentRef = useTemplateRef<HTMLTextAreaElement>('newContent');
const editContentRef = useTemplateRef<HTMLTextAreaElement>('editContent');

const sortedPages = computed(() => {
  if (!pages.value) return [];
  return [...(pages.value as DocsPage[])].sort((a, b) => a.sortOrder - b.sortOrder);
});
</script>

<template>
  <div class="docs-edit" v-if="site">
    <div class="docs-edit-header">
      <div>
        <h1 class="page-title">Edit: {{ site.name }}</h1>
        <NuxtLink :to="`/docs/${siteSlug}`" class="cpub-back-link">&larr; Back to docs</NuxtLink>
      </div>
    </div>

    <!-- ═══ SITE SETTINGS ═══ -->
    <section class="edit-section">
      <div class="section-header">
        <h2 class="section-heading"><i class="fa-solid fa-gear"></i> Site Settings</h2>
      </div>
      <div class="settings-form">
        <div class="form-field">
          <label class="form-label">Name</label>
          <input v-model="editSiteName" class="edit-input" />
        </div>
        <div class="form-field">
          <label class="form-label">Description</label>
          <textarea v-model="editSiteDesc" class="edit-textarea" rows="2" />
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="cpub-btn cpub-btn-sm" :disabled="savingSite" @click="saveSiteSettings">
            {{ savingSite ? 'Saving...' : 'Save Settings' }}
          </button>
          <button class="cpub-btn cpub-btn-sm" style="color: var(--red); border-color: var(--red-border); margin-left: auto;" @click="deleteSite">
            <i class="fa-solid fa-trash"></i> Delete Site
          </button>
        </div>
      </div>
    </section>

    <!-- ═══ PAGES ═══ -->
    <section class="edit-section">
      <div class="section-header">
        <h2 class="section-heading"><i class="fa-solid fa-file-lines"></i> Pages</h2>
        <button class="cpub-btn cpub-btn-sm" @click="showNewPage = !showNewPage">
          <i class="fa-solid fa-plus"></i> Add Page
        </button>
      </div>

      <!-- New page form -->
      <div v-if="showNewPage" class="new-form">
        <div class="form-row">
          <div class="form-field" style="flex:1">
            <label class="form-label">Title</label>
            <input v-model="newPageTitle" class="edit-input" placeholder="Page title" />
          </div>
          <div class="form-field" style="flex:1">
            <label class="form-label">Slug</label>
            <input v-model="newPageSlug" class="edit-input" placeholder="auto-generated" />
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Parent Page</label>
          <select v-model="newPageParentId" class="edit-select">
            <option :value="null">— None (top level) —</option>
            <option v-for="p in sortedPages" :key="p.id" :value="p.id">{{ p.title }}</option>
          </select>
        </div>
        <!-- Markdown toolbar -->
        <div class="md-toolbar">
          <button class="md-btn" title="Bold" @click="insertMarkdown(newContentRef!, '**', '**')"><b>B</b></button>
          <button class="md-btn" title="Italic" @click="insertMarkdown(newContentRef!, '_', '_')"><i>I</i></button>
          <button class="md-btn" title="Code" @click="insertMarkdown(newContentRef!, '`', '`')"><code>&lt;/&gt;</code></button>
          <button class="md-btn" title="Heading" @click="insertMarkdown(newContentRef!, '## ')">H</button>
          <button class="md-btn" title="Link" @click="insertMarkdown(newContentRef!, '[', '](url)')">🔗</button>
          <button class="md-btn" title="List" @click="insertMarkdown(newContentRef!, '- ')">≡</button>
        </div>
        <textarea ref="newContent" v-model="newPageContent" class="edit-textarea edit-textarea-md" placeholder="Markdown content..." rows="10" />
        <div class="form-actions">
          <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="savingPage || !newPageTitle.trim()" @click="createPage">
            {{ savingPage ? 'Creating...' : 'Create Page' }}
          </button>
          <button class="cpub-btn cpub-btn-sm" @click="showNewPage = false">Cancel</button>
        </div>
      </div>

      <!-- Page list -->
      <div v-if="sortedPages.length" class="page-list">
        <div v-for="(page, idx) in sortedPages" :key="page.id" class="page-item">
          <template v-if="editingPageId === page.id">
            <div class="form-row">
              <div class="form-field" style="flex:1">
                <label class="form-label">Title</label>
                <input v-model="editPageTitle" class="edit-input" />
              </div>
              <div class="form-field" style="flex:1">
                <label class="form-label">Parent</label>
                <select v-model="editPageParentId" class="edit-select">
                  <option :value="null">— None —</option>
                  <option v-for="p in sortedPages.filter(p => p.id !== page.id)" :key="p.id" :value="p.id">{{ p.title }}</option>
                </select>
              </div>
            </div>
            <!-- Toolbar + Preview toggle -->
            <div class="md-toolbar">
              <button class="md-btn" title="Bold" @click="insertMarkdown(editContentRef!, '**', '**')"><b>B</b></button>
              <button class="md-btn" title="Italic" @click="insertMarkdown(editContentRef!, '_', '_')"><i>I</i></button>
              <button class="md-btn" title="Code" @click="insertMarkdown(editContentRef!, '`', '`')"><code>&lt;/&gt;</code></button>
              <button class="md-btn" title="Heading" @click="insertMarkdown(editContentRef!, '## ')">H</button>
              <button class="md-btn" title="Link" @click="insertMarkdown(editContentRef!, '[', '](url)')">🔗</button>
              <button class="md-btn" title="List" @click="insertMarkdown(editContentRef!, '- ')">≡</button>
              <div class="md-spacer"></div>
              <button class="md-btn" :class="{ active: showPreview }" @click="showPreview = !showPreview">
                <i class="fa-solid fa-eye"></i> Preview
              </button>
            </div>
            <div class="editor-pane" :class="{ 'with-preview': showPreview }">
              <textarea ref="editContent" v-model="editPageContent" class="edit-textarea edit-textarea-md" rows="14" />
              <div v-if="showPreview" class="preview-pane"><pre class="preview-md">{{ editPageContent }}</pre></div>
            </div>
            <div class="form-actions">
              <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="savingEdit" @click="savePageEdit">
                {{ savingEdit ? 'Saving...' : 'Save' }}
              </button>
              <button class="cpub-btn cpub-btn-sm" @click="editingPageId = null">Cancel</button>
            </div>
          </template>
          <template v-else>
            <div class="page-item-row">
              <div class="page-item-info">
                <span class="page-item-title">{{ page.title }}</span>
                <span class="page-item-slug">/{{ page.slug }}</span>
                <span v-if="page.parentId" class="page-item-child-badge">child</span>
              </div>
              <div class="page-item-actions">
                <button class="page-action-btn" title="Move up" :disabled="idx === 0" @click="movePage(page.id, 'up')">
                  <i class="fa-solid fa-chevron-up"></i>
                </button>
                <button class="page-action-btn" title="Move down" :disabled="idx === sortedPages.length - 1" @click="movePage(page.id, 'down')">
                  <i class="fa-solid fa-chevron-down"></i>
                </button>
                <button class="cpub-btn cpub-btn-sm" @click="startEditPage(page)">
                  <i class="fa-solid fa-pen"></i> Edit
                </button>
                <button class="page-action-btn page-action-delete" title="Delete page" @click="deletePage(page.id)">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
      <p v-else class="edit-empty">No pages yet. Create one above.</p>
    </section>

    <!-- ═══ VERSIONS ═══ -->
    <section class="edit-section">
      <div class="section-header">
        <h2 class="section-heading"><i class="fa-solid fa-code-branch"></i> Versions</h2>
        <button class="cpub-btn cpub-btn-sm" @click="showNewVersion = !showNewVersion">
          <i class="fa-solid fa-plus"></i> Add Version
        </button>
      </div>

      <div v-if="showNewVersion" class="new-form">
        <input v-model="newVersion" class="edit-input" placeholder="Version (e.g. 1.0.0)" />
        <label class="cpub-checkbox">
          <input type="checkbox" v-model="newVersionDefault" /> Set as default version
        </label>
        <div class="form-actions">
          <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="savingVersion || !newVersion.trim()" @click="createVersion">
            {{ savingVersion ? 'Creating...' : 'Create Version' }}
          </button>
          <button class="cpub-btn cpub-btn-sm" @click="showNewVersion = false">Cancel</button>
        </div>
      </div>

      <div v-if="site.versions?.length" class="version-list">
        <div v-for="v in site.versions" :key="v.id" class="version-item">
          <span class="version-label">{{ v.version }}</span>
          <span v-if="v.isDefault" class="version-default-badge">default</span>
        </div>
      </div>
      <p v-else class="edit-empty">No versions yet.</p>
    </section>
  </div>
</template>

<style scoped>
.docs-edit { max-width: 800px; margin: 0 auto; padding: 32px; }
.docs-edit-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.cpub-back-link { color: var(--accent); text-decoration: none; font-size: 12px; }
.cpub-back-link:hover { text-decoration: underline; }

.edit-section { border: 2px solid var(--border); background: var(--surface); padding: 20px; margin-bottom: 16px; box-shadow: var(--shadow-md); }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-heading { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.section-heading i { font-size: 12px; color: var(--accent); }

.settings-form { display: flex; flex-direction: column; gap: 10px; }
.form-field { display: flex; flex-direction: column; gap: 3px; }
.form-label { font-size: 10px; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.form-row { display: flex; gap: 10px; }

.new-form { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 2px dashed var(--border); margin-bottom: 16px; background: var(--surface2); }
.edit-input { padding: 6px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; }
.edit-input:focus { border-color: var(--accent); outline: none; }
.edit-select { padding: 6px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 12px; }
.edit-select:focus { border-color: var(--accent); outline: none; }
.edit-textarea { padding: 8px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; resize: vertical; font-family: inherit; }
.edit-textarea-md { font-family: var(--font-mono); font-size: 13px; line-height: 1.6; min-height: 120px; }
.edit-textarea:focus { border-color: var(--accent); outline: none; }
.form-actions { display: flex; gap: 8px; margin-top: 4px; }

/* Markdown toolbar */
.md-toolbar { display: flex; gap: 2px; padding: 4px; background: var(--surface2); border: 2px solid var(--border); border-bottom: none; }
.md-btn { padding: 4px 8px; background: none; border: 2px solid transparent; color: var(--text-dim); cursor: pointer; font-size: 12px; font-family: var(--font-mono); display: inline-flex; align-items: center; gap: 4px; }
.md-btn:hover { background: var(--surface); border-color: var(--border); }
.md-btn.active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent-border); }
.md-spacer { flex: 1; }

/* Editor + Preview pane */
.editor-pane { display: flex; gap: 0; }
.editor-pane .edit-textarea-md { flex: 1; border-top: none; }
.editor-pane.with-preview .edit-textarea-md { width: 50%; }
.preview-pane { flex: 1; padding: 0; border: 2px solid var(--border); border-left: none; border-top: none; background: var(--surface); overflow-y: auto; max-height: 400px; }
.preview-md { margin: 0; padding: 12px 16px; font-size: 12px; font-family: var(--font-mono); line-height: 1.6; color: var(--text-dim); white-space: pre-wrap; word-wrap: break-word; }

/* Page list */
.page-list { display: flex; flex-direction: column; }
.page-item { padding: 12px 0; border-bottom: 2px solid var(--border2); }
.page-item:last-child { border-bottom: none; }
.page-item-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.page-item-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.page-item-title { font-size: 13px; font-weight: 600; }
.page-item-slug { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.page-item-child-badge { font-size: 9px; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); padding: 1px 6px; border: 2px solid var(--accent-border); }
.page-item-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.page-action-btn { padding: 4px 6px; background: none; border: 2px solid var(--border2); color: var(--text-faint); cursor: pointer; font-size: 10px; }
.page-action-btn:hover { color: var(--text); border-color: var(--border); }
.page-action-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.page-action-delete:hover { color: var(--red); border-color: var(--red); }

.version-list { display: flex; flex-wrap: wrap; gap: 8px; }
.version-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border: 2px solid var(--border); background: var(--surface2); font-size: 12px; font-family: var(--font-mono); }
.version-label { font-weight: 600; }
.version-default-badge { font-size: 10px; padding: 1px 6px; background: var(--accent-bg); color: var(--accent); border: 2px solid var(--accent-border); }

.edit-empty { color: var(--text-faint); font-size: 12px; padding: 16px 0; }
</style>
