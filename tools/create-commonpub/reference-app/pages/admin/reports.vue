<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: 'Reports — Admin — CommonPub' });

const { data: reportsData, refresh } = await useFetch('/api/admin/reports');
const toast = useToast();

interface Report {
  id: string;
  reason: string;
  description?: string;
  status: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

const reports = computed<Report[]>(() => {
  if (!reportsData.value) return [];
  if (Array.isArray(reportsData.value)) return reportsData.value as unknown as Report[];
  const data = reportsData.value as unknown as { items?: Report[] };
  return data.items ?? [];
});

async function resolveReport(id: string, resolution: 'resolved' | 'dismissed'): Promise<void> {
  try {
    await $fetch(`/api/admin/reports/${id}/resolve`, {
      method: 'POST',
      body: { resolution },
    });
    toast.success(`Report ${resolution}`);
    await refresh();
  } catch {
    toast.error('Failed to update report');
  }
}
</script>

<template>
  <div class="admin-reports">
    <h1 class="admin-page-title">Reports</h1>

    <template v-if="reports.length">
      <div class="report-card" v-for="report in reports" :key="report.id">
        <div class="report-header">
          <span class="report-status" :class="`status-${report.status}`">{{ report.status }}</span>
          <span class="report-type">{{ report.targetType }}</span>
          <time class="report-date">{{ new Date(report.createdAt).toLocaleDateString() }}</time>
        </div>
        <p class="report-reason"><strong>{{ report.reason }}</strong></p>
        <p v-if="report.description" class="report-desc">{{ report.description }}</p>
        <div class="report-meta">
          <span class="report-meta-item">Reporter: <code>{{ report.reporterId }}</code></span>
          <span class="report-meta-item">Target: <code>{{ report.targetId }}</code></span>
        </div>
        <div v-if="report.status === 'pending'" class="report-actions">
          <button class="cpub-btn cpub-btn-sm" style="color: var(--green); border-color: var(--green-border);" @click="resolveReport(report.id, 'resolved')">
            <i class="fa-solid fa-check"></i> Resolve
          </button>
          <button class="cpub-btn cpub-btn-sm" @click="resolveReport(report.id, 'dismissed')">
            <i class="fa-solid fa-xmark"></i> Dismiss
          </button>
        </div>
      </div>
    </template>
    <p class="admin-empty" v-else>No reports to review.</p>
  </div>
</template>

<style scoped>
.admin-page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-6); }
.report-card { padding: 16px; border: 2px solid var(--border); background: var(--surface); margin-bottom: 12px; box-shadow: 4px 4px 0 var(--border); }
.report-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.report-status { font-size: 10px; font-family: var(--font-mono); font-weight: 600; text-transform: uppercase; padding: 2px 8px; }
.status-pending { background: var(--yellow-bg); color: var(--yellow); border: 1px solid var(--yellow-border); }
.status-resolved { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.status-dismissed { background: var(--surface2); color: var(--text-faint); border: 1px solid var(--border2); }
.report-type { font-size: 10px; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); padding: 2px 6px; border: 1px solid var(--accent-border); }
.report-date { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }
.report-reason { font-size: 13px; margin-bottom: 4px; }
.report-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 8px; }
.report-meta { display: flex; gap: 16px; margin-bottom: 10px; }
.report-meta-item { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }
.report-meta-item code { background: var(--surface2); padding: 1px 4px; }
.report-actions { display: flex; gap: 6px; padding-top: 8px; border-top: 1px solid var(--border2); }
.admin-empty { color: var(--text-faint); text-align: center; padding: var(--space-8) 0; }
</style>
