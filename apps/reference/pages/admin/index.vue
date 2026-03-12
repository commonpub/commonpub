<script setup lang="ts">
definePageMeta({ layout: 'admin' });

useSeoMeta({ title: 'Admin Dashboard — CommonPub' });

const { data: stats } = await useFetch('/api/admin/stats');
</script>

<template>
  <div class="admin-dashboard">
    <h1 class="admin-page-title">Platform Dashboard</h1>

    <div class="stats-grid" v-if="stats">
      <div class="stat-card">
        <span class="stat-value">{{ stats.userCount ?? 0 }}</span>
        <span class="stat-label">Users</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.contentCount ?? 0 }}</span>
        <span class="stat-label">Content Items</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.communityCount ?? 0 }}</span>
        <span class="stat-label">Communities</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.commentCount ?? 0 }}</span>
        <span class="stat-label">Comments</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-4);
}

.stat-card {
  padding: var(--space-5);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-weight-bold);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-dim);
}
</style>
