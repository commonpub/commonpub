<script setup lang="ts">
definePageMeta({ layout: 'admin' });
useSeoMeta({ title: 'Admin Dashboard — CommonPub' });

const { data: stats } = await useFetch('/api/admin/stats');
</script>

<template>
  <div class="cpub-admin-dashboard">
    <h1 class="cpub-admin-title">Platform Dashboard</h1>

    <div class="cpub-stats-grid" v-if="stats">
      <div class="cpub-stat-card" v-for="stat in [
        { label: 'Users', value: stats.users?.total ?? 0, icon: 'fa-solid fa-users' },
        { label: 'Content', value: stats.content?.total ?? 0, icon: 'fa-solid fa-file-lines' },
        { label: 'Communities', value: stats.hubs?.total ?? 0, icon: 'fa-solid fa-people-group' },
        { label: 'Reports', value: stats.reports?.pending ?? 0, icon: 'fa-solid fa-flag' },
      ]" :key="stat.label">
        <i :class="[stat.icon, 'cpub-stat-icon']"></i>
        <span class="cpub-stat-value">{{ stat.value }}</span>
        <span class="cpub-stat-label">{{ stat.label }}</span>
      </div>
    </div>

    <div class="cpub-admin-quick-links">
      <h2 class="cpub-admin-section-title">Quick Actions</h2>
      <div class="cpub-admin-actions-grid">
        <NuxtLink to="/admin/users" class="cpub-admin-action">
          <i class="fa-solid fa-user-gear cpub-admin-action-icon"></i>
          <span class="cpub-admin-action-label">Manage Users</span>
        </NuxtLink>
        <NuxtLink to="/admin/reports" class="cpub-admin-action">
          <i class="fa-solid fa-flag cpub-admin-action-icon"></i>
          <span class="cpub-admin-action-label">Review Reports</span>
        </NuxtLink>
        <NuxtLink to="/admin/content" class="cpub-admin-action">
          <i class="fa-solid fa-newspaper cpub-admin-action-icon"></i>
          <span class="cpub-admin-action-label">Manage Content</span>
        </NuxtLink>
        <NuxtLink to="/admin/settings" class="cpub-admin-action">
          <i class="fa-solid fa-gear cpub-admin-action-icon"></i>
          <span class="cpub-admin-action-label">Instance Settings</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-admin-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-6); }
.cpub-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-8); }
.cpub-stat-card { padding: var(--space-5); background: var(--surface); border: 2px solid var(--border); box-shadow: 4px 4px 0 var(--border); display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
.cpub-stat-icon { font-size: var(--text-xl); color: var(--text-dim); margin-bottom: var(--space-1); }
.cpub-stat-value { font-size: var(--text-3xl); font-weight: var(--font-weight-bold); font-family: var(--font-mono); }
.cpub-stat-label { font-family: var(--font-mono); font-size: 10px; font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: var(--tracking-widest); color: var(--text-dim); }
.cpub-admin-section-title { font-size: var(--text-lg); font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); }
.cpub-admin-actions-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
.cpub-admin-action { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: var(--space-5); background: var(--surface); border: 2px solid var(--border); text-decoration: none; color: var(--text); transition: all 0.15s; }
.cpub-admin-action:hover { background: var(--surface2); box-shadow: 4px 4px 0 var(--border); transform: translate(-1px, -1px); }
.cpub-admin-action-icon { font-size: var(--text-xl); color: var(--text-dim); }
.cpub-admin-action-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--text-dim); }
</style>
