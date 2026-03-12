<script setup lang="ts">
definePageMeta({ layout: 'admin' });

useSeoMeta({ title: 'Audit Log — Admin — CommonPub' });

const { data: logs } = await useFetch('/api/admin/audit');
</script>

<template>
  <div class="admin-audit">
    <h1 class="admin-page-title">Audit Log</h1>

    <table class="admin-table" v-if="logs?.length">
      <thead>
        <tr>
          <th>Action</th>
          <th>Actor</th>
          <th>Target</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="log in logs" :key="log.id">
          <td class="audit-action">{{ log.action }}</td>
          <td>{{ log.actorId }}</td>
          <td>{{ log.targetId || '—' }}</td>
          <td>{{ new Date(log.createdAt).toLocaleString() }}</td>
        </tr>
      </tbody>
    </table>
    <p class="admin-empty" v-else>No audit log entries.</p>
  </div>
</template>

<style scoped>
.admin-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.admin-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 2px solid var(--border);
  font-weight: var(--font-weight-semibold);
  color: var(--text-dim);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.admin-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}

.audit-action {
  font-weight: var(--font-weight-medium);
}

.admin-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-8) 0;
}
</style>
