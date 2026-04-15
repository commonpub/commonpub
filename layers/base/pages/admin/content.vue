<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Content Management — Admin — ${useSiteName()}` });

const toast = useToast();

interface Category {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
}

const { data, refresh } = await useFetch('/api/content', {
  query: { limit: 50, sort: 'recent' },
});
const { data: categories } = await useFetch<Category[]>('/api/categories');

const selectedIds = ref<Set<string>>(new Set());
const selectAll = ref(false);

watch(selectAll, (val) => {
  if (val && data.value?.items) {
    selectedIds.value = new Set(data.value.items.filter(i => i.source !== 'federated').map(i => i.id));
  } else {
    selectedIds.value = new Set();
  }
});

function toggleSelect(id: string): void {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedIds.value = s;
}

async function bulkAction(action: 'feature' | 'unfeature' | 'editorial' | 'uneditorial'): Promise<void> {
  if (selectedIds.value.size === 0) return;
  const ids = Array.from(selectedIds.value);
  const body: Record<string, unknown> = { ids };
  if (action === 'feature') body.isFeatured = true;
  if (action === 'unfeature') body.isFeatured = false;
  if (action === 'editorial') body.isEditorial = true;
  if (action === 'uneditorial') body.isEditorial = false;

  try {
    await $fetch('/api/admin/content/bulk-editorial', { method: 'POST', body });
    toast.success(`Updated ${ids.length} items`);
    selectedIds.value = new Set();
    selectAll.value = false;
    await refresh();
  } catch {
    toast.error('Bulk action failed');
  }
}

async function bulkSetCategory(categoryId: string | null): Promise<void> {
  if (selectedIds.value.size === 0) return;
  try {
    await $fetch('/api/admin/content/bulk-editorial', {
      method: 'POST',
      body: { ids: Array.from(selectedIds.value), categoryId },
    });
    toast.success('Categories updated');
    selectedIds.value = new Set();
    selectAll.value = false;
    await refresh();
  } catch {
    toast.error('Failed to update categories');
  }
}

async function removeContent(id: string, title: string): Promise<void> {
  if (!confirm(`Remove "${title}"? This cannot be undone.`)) return;
  try {
    await $fetch(`/api/admin/content/${id}`, { method: 'DELETE' });
    toast.success('Content removed');
    await refresh();
  } catch {
    toast.error('Failed to remove content');
  }
}

async function toggleFeatured(id: string, current: boolean): Promise<void> {
  try {
    await $fetch(`/api/admin/content/${id}`, {
      method: 'PATCH',
      body: { isFeatured: !current },
    });
    toast.success(current ? 'Unfeatured' : 'Featured on homepage');
    await refresh();
  } catch {
    toast.error('Failed to update featured status');
  }
}

async function toggleEditorial(id: string, current: boolean): Promise<void> {
  try {
    await $fetch(`/api/admin/content/${id}`, {
      method: 'PATCH',
      body: { isEditorial: !current },
    });
    toast.success(current ? 'Removed from Staff Picks' : 'Marked as Staff Pick');
    await refresh();
  } catch {
    toast.error('Failed to update editorial status');
  }
}

async function setCategory(id: string, categoryId: string | null): Promise<void> {
  try {
    await $fetch(`/api/admin/content/${id}`, {
      method: 'PATCH',
      body: { categoryId },
    });
    toast.success('Category updated');
    await refresh();
  } catch {
    toast.error('Failed to update category');
  }
}
</script>

<template>
  <div class="cpub-admin-content">
    <h1 class="cpub-admin-title">Content Management</h1>

    <!-- Bulk Actions Bar -->
    <div v-if="selectedIds.size > 0" class="cpub-bulk-bar">
      <span class="cpub-bulk-count">{{ selectedIds.size }} selected</span>
      <button class="cpub-btn cpub-btn-sm" @click="bulkAction('feature')"><i class="fa-solid fa-star"></i> Feature</button>
      <button class="cpub-btn cpub-btn-sm" @click="bulkAction('unfeature')"><i class="fa-regular fa-star"></i> Unfeature</button>
      <button class="cpub-btn cpub-btn-sm" @click="bulkAction('editorial')"><i class="fa-solid fa-pen-fancy"></i> Staff Pick</button>
      <button class="cpub-btn cpub-btn-sm" @click="bulkAction('uneditorial')"><i class="fa-regular fa-pen-to-square"></i> Unpick</button>
      <select class="cpub-bulk-cat-select" @change="(e) => bulkSetCategory((e.target as HTMLSelectElement).value || null)" aria-label="Set category">
        <option value="">Set Category...</option>
        <option :value="''" v-if="false">—</option>
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        <option value="">Remove Category</option>
      </select>
    </div>

    <div class="cpub-admin-table-wrap" v-if="data?.items?.length">
      <table class="cpub-admin-table">
        <thead>
          <tr>
            <th><input type="checkbox" v-model="selectAll" aria-label="Select all" /></th>
            <th>Title</th>
            <th>Type</th>
            <th>Category</th>
            <th>Author</th>
            <th>Status</th>
            <th>Views</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in data.items" :key="item.id" :class="{ 'cpub-row-selected': selectedIds.has(item.id) }">
            <td>
              <input
                v-if="item.source !== 'federated'"
                type="checkbox"
                :checked="selectedIds.has(item.id)"
                @change="toggleSelect(item.id)"
                :aria-label="`Select ${item.title}`"
              />
            </td>
            <td>
              <NuxtLink :to="`/u/${item.author?.username}/${item.type}/${item.slug}`" class="cpub-admin-link">{{ item.title }}</NuxtLink>
              <div class="cpub-admin-badges" v-if="item.isEditorial || item.isFeatured">
                <span v-if="item.isEditorial" class="cpub-mini-badge cpub-mini-badge--editorial"><i class="fa-solid fa-pen-fancy"></i> Staff Pick</span>
                <span v-if="item.isFeatured" class="cpub-mini-badge cpub-mini-badge--featured"><i class="fa-solid fa-star"></i></span>
              </div>
            </td>
            <td><ContentTypeBadge :type="item.type" /></td>
            <td>
              <select
                v-if="item.source !== 'federated'"
                class="cpub-cat-select"
                :value="item.categoryId || ''"
                @change="setCategory(item.id, ($event.target as HTMLSelectElement).value || null)"
                aria-label="Category"
              >
                <option value="">None</option>
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
              </select>
            </td>
            <td class="cpub-admin-author">{{ item.author?.displayName || item.author?.username || 'Unknown' }}</td>
            <td>
              <span :class="['cpub-status-badge', `cpub-status-${item.status}`]">{{ item.status }}</span>
            </td>
            <td class="cpub-admin-num">{{ item.viewCount ?? 0 }}</td>
            <td class="cpub-admin-date">{{ new Date(item.createdAt).toLocaleDateString() }}</td>
            <td class="cpub-admin-actions">
              <button
                v-if="item.source !== 'federated'"
                class="cpub-admin-action"
                :class="{ 'cpub-admin-action--active': item.isEditorial }"
                :title="item.isEditorial ? 'Remove Staff Pick' : 'Mark as Staff Pick'"
                @click="toggleEditorial(item.id, !!item.isEditorial)"
              >
                <i class="fa-solid fa-pen-fancy"></i>
              </button>
              <button
                v-if="item.source !== 'federated'"
                class="cpub-admin-action"
                :class="{ 'cpub-admin-action--active-star': item.isFeatured }"
                :title="item.isFeatured ? 'Remove from featured' : 'Feature on homepage'"
                @click="toggleFeatured(item.id, !!item.isFeatured)"
              >
                <i class="fa-solid fa-star"></i>
              </button>
              <span v-if="item.source === 'federated'" class="cpub-admin-federated-tag">
                <i class="fa-solid fa-globe"></i> federated
              </span>
              <button class="cpub-admin-action cpub-admin-action--danger" title="Remove content" @click="removeContent(item.id, item.title)">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="cpub-empty" v-else>No content found.</p>
  </div>
</template>

<style scoped>
.cpub-admin-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-6); }

.cpub-bulk-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--accent-bg);
  border: var(--border-width-default) solid var(--accent-border);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}
.cpub-bulk-count { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--accent); margin-right: var(--space-2); }
.cpub-bulk-cat-select {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 4px 8px;
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
}

.cpub-admin-table-wrap { overflow-x: auto; }
.cpub-admin-table { width: 100%; border-collapse: collapse; }
.cpub-admin-table th { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); text-align: left; padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-admin-table td { padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border2); font-size: 13px; }
.cpub-admin-link { color: var(--text); text-decoration: none; font-weight: 500; }
.cpub-admin-link:hover { color: var(--accent); }
.cpub-admin-author { font-size: 12px; color: var(--text-dim); }
.cpub-admin-num { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.cpub-admin-date { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.cpub-status-badge { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; padding: 2px 8px; }
.cpub-status-published { color: var(--green); background: var(--green-bg); border: var(--border-width-default) solid var(--green-border); }
.cpub-status-draft { color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border2); }
.cpub-admin-actions { display: flex; gap: 6px; }
.cpub-admin-action { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.cpub-admin-action:hover { color: var(--accent); }
.cpub-admin-action--active { color: var(--teal); }
.cpub-admin-action--active-star { color: var(--yellow, #e6b800); }
.cpub-admin-action--danger:hover { color: var(--red); }
.cpub-admin-federated-tag { font-family: var(--font-mono); font-size: 9px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 3px; }
.cpub-row-selected { background: var(--accent-bg); }
.cpub-admin-badges { display: flex; gap: 4px; margin-top: 2px; }
.cpub-mini-badge { font-family: var(--font-mono); font-size: 9px; display: inline-flex; align-items: center; gap: 3px; }
.cpub-mini-badge--editorial { color: var(--teal); }
.cpub-mini-badge--featured { color: var(--yellow, #e6b800); }
.cpub-cat-select {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 3px 6px;
  border: var(--border-width-default) solid var(--border2);
  background: var(--surface);
  color: var(--text-dim);
  cursor: pointer;
  max-width: 120px;
}
.cpub-empty { color: var(--text-faint); text-align: center; padding: var(--space-10) 0; }

@media (max-width: 768px) {
  .cpub-admin-title { font-size: var(--text-lg); }
  .cpub-admin-table { font-size: var(--text-xs); display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cpub-admin-table th, .cpub-admin-table td { padding: var(--space-1) var(--space-2); white-space: nowrap; }
}
</style>
