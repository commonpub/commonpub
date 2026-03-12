<script setup lang="ts">
definePageMeta({ layout: 'admin' });

useSeoMeta({ title: 'Settings — Admin — CommonPub' });

const { data: settings } = await useFetch('/api/admin/settings');
</script>

<template>
  <div class="admin-settings">
    <h1 class="admin-page-title">Instance Settings</h1>

    <div class="settings-card" v-if="settings">
      <p class="settings-info">Instance settings management coming soon.</p>
      <pre class="settings-json">{{ JSON.stringify(settings, null, 2) }}</pre>
    </div>
    <p class="admin-empty" v-else>No settings configured.</p>
  </div>
</template>

<style scoped>
.admin-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.settings-card {
  padding: var(--space-4);
  border: 1px solid var(--border);
  background: var(--surface);
}

.settings-info {
  color: var(--text-dim);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.settings-json {
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  background: var(--surface2);
  padding: var(--space-3);
  overflow-x: auto;
  color: var(--text-dim);
}

.admin-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-8) 0;
}
</style>
