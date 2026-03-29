<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: 'Content Management — Admin — CommonPub' });

const toast = useToast();
const { data, refresh } = await useFetch('/api/content', {
  query: { limit: 50, sort: 'recent' },
});

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
</script>

<template>
  <div class="cpub-admin-content">
    <h1 class="cpub-admin-title">Content Management</h1>

    <div class="cpub-admin-table-wrap" v-if="data?.items?.length">
      <table class="cpub-admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Author</th>
            <th>Status</th>
            <th>Views</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in data.items" :key="item.id">
            <td>
              <NuxtLink :to="`/${item.type}/${item.slug}`" class="cpub-admin-link">{{ item.title }}</NuxtLink>
            </td>
            <td><ContentTypeBadge :type="item.type" /></td>
            <td class="cpub-admin-author">{{ item.author?.displayName || item.author?.username || 'Unknown' }}</td>
            <td>
              <span :class="['cpub-status-badge', `cpub-status-${item.status}`]">{{ item.status }}</span>
            </td>
            <td class="cpub-admin-num">{{ item.viewCount ?? 0 }}</td>
            <td class="cpub-admin-date">{{ new Date(item.createdAt).toLocaleDateString() }}</td>
            <td>
              <button class="cpub-admin-delete" title="Remove content" @click="removeContent(item.id, item.title)">
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
.cpub-admin-table-wrap { overflow-x: auto; }
.cpub-admin-table { width: 100%; border-collapse: collapse; }
.cpub-admin-table th { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border); }
.cpub-admin-table td { padding: 8px 12px; border-bottom: 2px solid var(--border2); font-size: 13px; }
.cpub-admin-link { color: var(--text); text-decoration: none; font-weight: 500; }
.cpub-admin-link:hover { color: var(--accent); }
.cpub-admin-author { font-size: 12px; color: var(--text-dim); }
.cpub-admin-num { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.cpub-admin-date { font-family: var(--font-mono); font-size: 11px; color: var(--text-faint); }
.cpub-status-badge { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; padding: 2px 8px; }
.cpub-status-published { color: var(--green); background: var(--green-bg); border: 2px solid var(--green-border); }
.cpub-status-draft { color: var(--text-dim); background: var(--surface2); border: 2px solid var(--border2); }
.cpub-admin-delete { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.cpub-admin-delete:hover { color: var(--red); }
.cpub-empty { color: var(--text-faint); text-align: center; padding: var(--space-10) 0; }
</style>
