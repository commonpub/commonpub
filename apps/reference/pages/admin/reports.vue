<script setup lang="ts">
definePageMeta({ layout: 'admin' });

useSeoMeta({ title: 'Reports — Admin — CommonPub' });

const { data: reports } = await useFetch('/api/admin/reports');
</script>

<template>
  <div class="admin-reports">
    <h1 class="admin-page-title">Reports</h1>

    <template v-if="reports?.length">
      <div class="report-card" v-for="report in reports" :key="report.id">
        <div class="report-header">
          <span class="report-status" :class="`status-${report.status}`">{{ report.status }}</span>
          <time class="report-date">{{ new Date(report.createdAt).toLocaleDateString() }}</time>
        </div>
        <p class="report-reason">{{ report.reason }}</p>
      </div>
    </template>
    <p class="admin-empty" v-else>No reports to review.</p>
  </div>
</template>

<style scoped>
.admin-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.report-card {
  padding: var(--space-4);
  border: 1px solid var(--border);
  background: var(--surface);
  margin-bottom: var(--space-3);
}

.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.report-status {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  text-transform: capitalize;
  padding: var(--space-1) var(--space-2);
}

.status-pending {
  background: var(--yellow-bg, var(--surface2));
  color: var(--yellow, var(--text));
}

.status-resolved {
  background: var(--green-bg, var(--surface2));
  color: var(--green, var(--text));
}

.report-date {
  font-size: var(--text-xs);
  color: var(--text-faint);
}

.report-reason {
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.admin-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-8) 0;
}
</style>
