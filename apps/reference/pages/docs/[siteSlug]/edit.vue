<script setup lang="ts">
definePageMeta({ middleware: 'auth' });

const route = useRoute();
const siteSlug = computed(() => route.params.siteSlug as string);

const { data: site, refresh: refreshSite } = await useFetch(() => `/api/docs/${siteSlug.value}`);
const { data: pages, refresh: refreshPages } = await useFetch(() => `/api/docs/${siteSlug.value}/pages`);

useSeoMeta({ title: () => `Edit ${site.value?.title ?? 'Docs'} — CommonPub` });

const { show: toast } = useToast();

// Page creation
const showNewPage = ref(false);
const newPageTitle = ref('');
const newPageSlug = ref('');
const newPageContent = ref('');
const savingPage = ref(false);

// Version creation
const showNewVersion = ref(false);
const newVersion = ref('');
const newVersionDefault = ref(false);
const savingVersion = ref(false);

// Editing page
const editingPageId = ref<string | null>(null);
const editPageContent = ref('');
const editPageTitle = ref('');
const savingEdit = ref(false);

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
        sortOrder: (pages.value?.length ?? 0) + 1,
      },
    });
    toast('Page created', 'success');
    newPageTitle.value = '';
    newPageSlug.value = '';
    newPageContent.value = '';
    showNewPage.value = false;
    await refreshPages();
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : 'Failed to create page', 'error');
  } finally {
    savingPage.value = false;
  }
}

async function createVersion(): Promise<void> {
  if (!newVersion.value.trim()) return;
  savingVersion.value = true;
  try {
    await $fetch(`/api/docs/${siteSlug.value}/versions`, {
      method: 'POST',
      body: {
        version: newVersion.value,
        isDefault: newVersionDefault.value ? 1 : 0,
      },
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

interface DocsPage { id: string; title: string; slug: string; content: string; sortOrder: number }

function startEditPage(page: DocsPage): void {
  editingPageId.value = page.id;
  editPageTitle.value = page.title;
  editPageContent.value = page.content ?? '';
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
</script>

<template>
  <div class="docs-edit" v-if="site">
    <div class="docs-edit-header">
      <div>
        <h1 class="page-title">Edit: {{ site.title }}</h1>
        <NuxtLink :to="`/docs/${siteSlug}`" class="cpub-back-link">&larr; Back to docs</NuxtLink>
      </div>
    </div>

    <!-- ═══ PAGES ═══ -->
    <section class="edit-section">
      <div class="section-header">
        <h2 class="section-heading">Pages</h2>
        <button class="cpub-btn cpub-btn-sm" @click="showNewPage = !showNewPage">
          <i class="fa-solid fa-plus"></i> Add Page
        </button>
      </div>

      <div v-if="showNewPage" class="new-form">
        <input v-model="newPageTitle" class="edit-input" placeholder="Page title" />
        <input v-model="newPageSlug" class="edit-input" placeholder="slug (auto-generated)" />
        <textarea v-model="newPageContent" class="edit-textarea" placeholder="Markdown content..." rows="8" />
        <div class="form-actions">
          <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="savingPage || !newPageTitle.trim()" @click="createPage">
            {{ savingPage ? 'Creating...' : 'Create Page' }}
          </button>
          <button class="cpub-btn cpub-btn-sm" @click="showNewPage = false">Cancel</button>
        </div>
      </div>

      <div v-if="pages?.length" class="page-list">
        <div v-for="page in (pages as DocsPage[])" :key="page.id" class="page-item">
          <template v-if="editingPageId === page.id">
            <input v-model="editPageTitle" class="edit-input" placeholder="Page title" />
            <textarea v-model="editPageContent" class="edit-textarea" rows="10" />
            <div class="form-actions">
              <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="savingEdit" @click="savePageEdit">
                {{ savingEdit ? 'Saving...' : 'Save' }}
              </button>
              <button class="cpub-btn cpub-btn-sm" @click="editingPageId = null">Cancel</button>
            </div>
          </template>
          <template v-else>
            <div class="page-item-row">
              <div>
                <span class="page-item-title">{{ page.title }}</span>
                <span class="page-item-slug">/{{ page.slug }}</span>
              </div>
              <button class="cpub-btn cpub-btn-sm" @click="startEditPage(page)">
                <i class="fa-solid fa-pen"></i> Edit
              </button>
            </div>
          </template>
        </div>
      </div>
      <p v-else class="edit-empty">No pages yet. Create one above.</p>
    </section>

    <!-- ═══ VERSIONS ═══ -->
    <section class="edit-section">
      <div class="section-header">
        <h2 class="section-heading">Versions</h2>
        <button class="cpub-btn cpub-btn-sm" @click="showNewVersion = !showNewVersion">
          <i class="fa-solid fa-plus"></i> Add Version
        </button>
      </div>

      <div v-if="showNewVersion" class="new-form">
        <input v-model="newVersion" class="edit-input" placeholder="Version (e.g. 1.0.0)" />
        <label class="cpub-checkbox" style="margin-top: 8px">
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
.docs-edit { max-width: 720px; }
.docs-edit-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-6); }
.page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-1); }
.cpub-back-link { color: var(--accent); text-decoration: none; font-size: var(--text-sm); }
.cpub-back-link:hover { text-decoration: underline; }

.edit-section { border: 1px solid var(--border); background: var(--surface); padding: var(--space-4); margin-bottom: var(--space-4); }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
.section-heading { font-size: var(--text-md); font-weight: var(--font-weight-semibold); }

.new-form { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); border: 1px dashed var(--border); margin-bottom: var(--space-3); }
.edit-input { padding: 6px 10px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: var(--text-sm); }
.edit-textarea { padding: 8px 10px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: var(--text-sm); font-family: var(--font-mono); resize: vertical; }
.form-actions { display: flex; gap: var(--space-2); margin-top: var(--space-2); }

.page-list { display: flex; flex-direction: column; }
.page-item { padding: var(--space-3) 0; border-bottom: 1px solid var(--border); }
.page-item:last-child { border-bottom: none; }
.page-item-row { display: flex; align-items: center; justify-content: space-between; }
.page-item-title { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); }
.page-item-slug { font-size: var(--text-xs); font-family: var(--font-mono); color: var(--text-faint); margin-left: var(--space-2); }

.version-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.version-item { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); border: 1px solid var(--border); background: var(--surface2); font-size: var(--text-sm); font-family: var(--font-mono); }
.version-label { font-weight: var(--font-weight-semibold); }
.version-default-badge { font-size: var(--text-xs); padding: 1px 6px; background: var(--accent-bg); color: var(--accent); border: 1px solid var(--accent-border); }

.edit-empty { color: var(--text-faint); font-size: var(--text-sm); padding: var(--space-3) 0; }
</style>
