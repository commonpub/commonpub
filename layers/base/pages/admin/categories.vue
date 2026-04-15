<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Categories — Admin — ${useSiteName()}` });

const toast = useToast();

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
}

const { data: categories, refresh } = await useFetch<Category[]>('/api/admin/categories');

const showForm = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  slug: '',
  description: '',
  color: '',
  icon: '',
  sortOrder: 0,
});

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function openNew(): void {
  editingId.value = null;
  form.value = { name: '', slug: '', description: '', color: '', icon: '', sortOrder: categories.value?.length ?? 0 };
  showForm.value = true;
}

function openEdit(cat: Category): void {
  editingId.value = cat.id;
  form.value = {
    name: cat.name,
    slug: cat.slug,
    description: cat.description ?? '',
    color: cat.color ?? '',
    icon: cat.icon ?? '',
    sortOrder: cat.sortOrder,
  };
  showForm.value = true;
}

function cancelForm(): void {
  showForm.value = false;
  editingId.value = null;
}

watch(() => form.value.name, (name) => {
  if (!editingId.value) {
    form.value.slug = generateSlug(name);
  }
});

async function saveCategory(): Promise<void> {
  const payload = {
    name: form.value.name,
    slug: form.value.slug,
    description: form.value.description || undefined,
    color: form.value.color || undefined,
    icon: form.value.icon || undefined,
    sortOrder: form.value.sortOrder,
  };

  try {
    if (editingId.value) {
      await $fetch(`/api/admin/categories/${editingId.value}`, { method: 'PATCH', body: payload });
      toast.success('Category updated');
    } else {
      await $fetch('/api/admin/categories', { method: 'POST', body: payload });
      toast.success('Category created');
    }
    showForm.value = false;
    editingId.value = null;
    await refresh();
  } catch {
    toast.error('Failed to save category');
  }
}

async function deleteCategory(cat: Category): Promise<void> {
  if (cat.isSystem) {
    toast.error('Cannot delete system categories');
    return;
  }
  if (!confirm(`Delete "${cat.name}"? Content using this category will become uncategorized.`)) return;
  try {
    await $fetch(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
    toast.success('Category deleted');
    await refresh();
  } catch {
    toast.error('Failed to delete category');
  }
}
</script>

<template>
  <div class="cpub-admin-categories">
    <div class="cpub-admin-header">
      <h1 class="cpub-admin-title">Content Categories</h1>
      <button class="cpub-btn cpub-btn-primary cpub-btn-sm" @click="openNew">
        <i class="fa-solid fa-plus"></i> New Category
      </button>
    </div>

    <!-- Category Form -->
    <div v-if="showForm" class="cpub-cat-form">
      <h2 class="cpub-cat-form-title">{{ editingId ? 'Edit Category' : 'New Category' }}</h2>
      <div class="cpub-cat-form-grid">
        <div class="cpub-cat-field">
          <label class="cpub-cat-label">Name</label>
          <input v-model="form.name" class="cpub-cat-input" placeholder="e.g. Deep Dive" />
        </div>
        <div class="cpub-cat-field">
          <label class="cpub-cat-label">Slug</label>
          <input v-model="form.slug" class="cpub-cat-input" placeholder="e.g. deep-dive" />
        </div>
        <div class="cpub-cat-field">
          <label class="cpub-cat-label">Description</label>
          <input v-model="form.description" class="cpub-cat-input" placeholder="Optional description" />
        </div>
        <div class="cpub-cat-field">
          <label class="cpub-cat-label">Icon (Font Awesome class)</label>
          <input v-model="form.icon" class="cpub-cat-input" placeholder="e.g. fa-solid fa-newspaper" />
        </div>
        <div class="cpub-cat-field">
          <label class="cpub-cat-label">Color</label>
          <input v-model="form.color" class="cpub-cat-input" placeholder="e.g. var(--teal) or #5b9cf6" />
        </div>
        <div class="cpub-cat-field">
          <label class="cpub-cat-label">Sort Order</label>
          <input v-model.number="form.sortOrder" type="number" class="cpub-cat-input" min="0" />
        </div>
      </div>
      <div class="cpub-cat-form-actions">
        <button class="cpub-btn cpub-btn-primary cpub-btn-sm" @click="saveCategory">
          {{ editingId ? 'Update' : 'Create' }}
        </button>
        <button class="cpub-btn cpub-btn-sm" @click="cancelForm">Cancel</button>
      </div>
    </div>

    <!-- Categories Table -->
    <div class="cpub-admin-table-wrap" v-if="categories?.length">
      <table class="cpub-admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Name</th>
            <th>Slug</th>
            <th>Icon</th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categories" :key="cat.id">
            <td class="cpub-admin-num">{{ cat.sortOrder }}</td>
            <td>
              <span class="cpub-cat-name">
                <i v-if="cat.icon" :class="cat.icon" :style="{ color: cat.color || 'var(--text-dim)' }"></i>
                {{ cat.name }}
              </span>
            </td>
            <td class="cpub-admin-slug">{{ cat.slug }}</td>
            <td class="cpub-admin-icon-cell"><code v-if="cat.icon">{{ cat.icon }}</code></td>
            <td>
              <span :class="['cpub-cat-type', cat.isSystem ? 'cpub-cat-system' : 'cpub-cat-custom']">
                {{ cat.isSystem ? 'System' : 'Custom' }}
              </span>
            </td>
            <td class="cpub-admin-actions">
              <button class="cpub-admin-action" title="Edit" @click="openEdit(cat)">
                <i class="fa-solid fa-pencil"></i>
              </button>
              <button
                v-if="!cat.isSystem"
                class="cpub-admin-action cpub-admin-action--danger"
                title="Delete"
                @click="deleteCategory(cat)"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="cpub-empty" v-else>No categories found. Create one to get started.</p>
  </div>
</template>

<style scoped>
.cpub-admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
.cpub-admin-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); }

.cpub-cat-form {
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
}

.cpub-cat-form-title { font-size: var(--text-base); font-weight: 600; margin-bottom: var(--space-4); }

.cpub-cat-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.cpub-cat-field { display: flex; flex-direction: column; gap: 4px; }
.cpub-cat-label { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
.cpub-cat-input {
  font-size: 13px;
  padding: 6px 10px;
  border: var(--border-width-default) solid var(--border);
  background: var(--bg);
  color: var(--text);
  outline: none;
}
.cpub-cat-input:focus { border-color: var(--accent); }

.cpub-cat-form-actions { display: flex; gap: var(--space-2); margin-top: var(--space-4); }

.cpub-admin-table-wrap { overflow-x: auto; }
.cpub-admin-table { width: 100%; border-collapse: collapse; }
.cpub-admin-table th { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); text-align: left; padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border); }
.cpub-admin-table td { padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border2); font-size: 13px; }
.cpub-admin-num { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.cpub-admin-slug { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); }
.cpub-admin-icon-cell code { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }
.cpub-admin-actions { display: flex; gap: 6px; }
.cpub-admin-action { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.cpub-admin-action:hover { color: var(--accent); }
.cpub-admin-action--danger:hover { color: var(--red); }

.cpub-cat-name { display: flex; align-items: center; gap: 6px; font-weight: 500; }
.cpub-cat-type { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; padding: 2px 8px; }
.cpub-cat-system { color: var(--teal); background: var(--teal-bg, var(--surface2)); border: var(--border-width-default) solid var(--teal-border, var(--border2)); }
.cpub-cat-custom { color: var(--text-dim); background: var(--surface2); border: var(--border-width-default) solid var(--border2); }

.cpub-empty { color: var(--text-faint); text-align: center; padding: var(--space-10) 0; }

@media (max-width: 768px) {
  .cpub-cat-form-grid { grid-template-columns: 1fr; }
  .cpub-admin-header { flex-direction: column; gap: var(--space-3); align-items: flex-start; }
}
</style>
