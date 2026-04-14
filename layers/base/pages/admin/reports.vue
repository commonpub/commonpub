<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Reports — Admin — ${useSiteName()}` });

const toast = useToast();
const statusFilter = ref<string>('pending');

const { data: reportsData, refresh } = await useFetch(() => {
  const base = '/api/admin/reports';
  return statusFilter.value ? `${base}?status=${statusFilter.value}` : base;
});

interface Report {
  id: string;
  reason: string;
  description?: string;
  status: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  reporter?: { id: string; username: string };
  reviewer?: { id: string; username: string } | null;
  resolution?: string | null;
}

const reports = computed<Report[]>(() => {
  if (!reportsData.value) return [];
  if (Array.isArray(reportsData.value)) return reportsData.value as unknown as Report[];
  const data = reportsData.value as unknown as { items?: Report[] };
  return data.items ?? [];
});

// Bulk selection
const selectedIds = ref<Set<string>>(new Set());
const allSelected = computed(() => reports.value.length > 0 && reports.value.every(r => selectedIds.value.has(r.id)));

function toggleSelect(id: string): void {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  selectedIds.value = s;
}

function toggleSelectAll(): void {
  if (allSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(reports.value.map(r => r.id));
  }
}

// Single report actions
async function resolveReport(id: string, status: 'reviewed' | 'resolved' | 'dismissed', resolution?: string): Promise<void> {
  const text = resolution ?? prompt(`Reason for ${status}:`);
  if (!text) return;
  try {
    await $fetch(`/api/admin/reports/${id}/resolve` as string, {
      method: 'POST',
      body: { status, resolution: text },
    });
    toast.success(`Report ${status}`);
    selectedIds.value.delete(id);
    await refresh();
  } catch {
    toast.error('Failed to update report');
  }
}

// Bulk actions
async function bulkAction(status: 'reviewed' | 'resolved' | 'dismissed'): Promise<void> {
  if (selectedIds.value.size === 0) return;
  const text = prompt(`Reason for bulk ${status} (${selectedIds.value.size} reports):`);
  if (!text) return;
  let successCount = 0;
  for (const id of selectedIds.value) {
    try {
      await $fetch(`/api/admin/reports/${id}/resolve` as string, {
        method: 'POST',
        body: { status, resolution: text },
      });
      successCount++;
    } catch {
      // continue with remaining
    }
  }
  toast.success(`${successCount} report${successCount === 1 ? '' : 's'} ${status}`);
  selectedIds.value = new Set();
  await refresh();
}

watch(statusFilter, () => {
  selectedIds.value = new Set();
});
</script>

<template>
  <div class="cpub-admin-reports">
    <h1 class="cpub-admin-page-title">Reports</h1>

    <!-- Filter bar -->
    <div class="cpub-report-filters">
      <button
        v-for="s in ['pending', 'reviewed', 'resolved', 'dismissed', '']"
        :key="s"
        class="cpub-report-filter-btn"
        :class="{ 'cpub-report-filter-active': statusFilter === s }"
        @click="statusFilter = s"
      >
        {{ s || 'All' }}
      </button>
    </div>

    <!-- Bulk actions -->
    <div v-if="selectedIds.size > 0" class="cpub-report-bulk">
      <span class="cpub-report-bulk-count">{{ selectedIds.size }} selected</span>
      <button v-if="statusFilter === 'pending'" class="cpub-btn cpub-btn-sm" @click="bulkAction('reviewed')">
        <i class="fa-solid fa-eye" /> Mark Reviewed
      </button>
      <button class="cpub-btn cpub-btn-sm" style="color: var(--green); border-color: var(--green-border);" @click="bulkAction('resolved')">
        <i class="fa-solid fa-check" /> Resolve
      </button>
      <button class="cpub-btn cpub-btn-sm" @click="bulkAction('dismissed')">
        <i class="fa-solid fa-xmark" /> Dismiss
      </button>
    </div>

    <template v-if="reports.length">
      <div class="cpub-report-card" v-for="report in reports" :key="report.id">
        <div class="cpub-report-header">
          <label class="cpub-report-checkbox" @click.stop>
            <input type="checkbox" :checked="selectedIds.has(report.id)" @change="toggleSelect(report.id)" />
          </label>
          <span class="cpub-report-status" :class="`cpub-status-${report.status}`">{{ report.status }}</span>
          <span class="cpub-report-type">{{ report.targetType }}</span>
          <time class="cpub-report-date">{{ new Date(report.createdAt).toLocaleDateString() }}</time>
        </div>
        <p class="cpub-report-reason"><strong>{{ report.reason }}</strong></p>
        <p v-if="report.description" class="cpub-report-desc">{{ report.description }}</p>
        <div class="cpub-report-meta">
          <span class="cpub-report-meta-item">Reporter: <code>{{ report.reporter?.username ?? report.reporterId }}</code></span>
          <span class="cpub-report-meta-item">Target: <code>{{ report.targetId.slice(0, 8) }}...</code></span>
          <span v-if="report.reviewer" class="cpub-report-meta-item">Reviewed by: <code>{{ report.reviewer.username }}</code></span>
        </div>
        <p v-if="report.resolution" class="cpub-report-resolution">
          <i class="fa-solid fa-comment-dots" /> {{ report.resolution }}
        </p>
        <div v-if="report.status === 'pending' || report.status === 'reviewed'" class="cpub-report-actions">
          <button v-if="report.status === 'pending'" class="cpub-btn cpub-btn-sm" @click="resolveReport(report.id, 'reviewed')">
            <i class="fa-solid fa-eye" /> Mark Reviewed
          </button>
          <button class="cpub-btn cpub-btn-sm" style="color: var(--green); border-color: var(--green-border);" @click="resolveReport(report.id, 'resolved')">
            <i class="fa-solid fa-check" /> Resolve
          </button>
          <button class="cpub-btn cpub-btn-sm" @click="resolveReport(report.id, 'dismissed')">
            <i class="fa-solid fa-xmark" /> Dismiss
          </button>
        </div>
      </div>

      <!-- Select all -->
      <div class="cpub-report-select-all">
        <label @click.stop>
          <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
          <span>Select all</span>
        </label>
      </div>
    </template>
    <p class="cpub-admin-empty" v-else>No reports{{ statusFilter ? ` with status "${statusFilter}"` : '' }}.</p>
  </div>
</template>

<style scoped>
.cpub-admin-page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: var(--space-6); }
.cpub-report-filters { display: flex; gap: 4px; margin-bottom: var(--space-4); flex-wrap: wrap; }
.cpub-report-filter-btn { padding: 4px 10px; font-size: 11px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.04em; background: var(--surface); border: var(--border-width-default) solid var(--border); color: var(--text-dim); cursor: pointer; }
.cpub-report-filter-btn:hover { border-color: var(--accent); color: var(--accent); }
.cpub-report-filter-active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
.cpub-report-bulk { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin-bottom: var(--space-3); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); }
.cpub-report-bulk-count { font-size: 11px; font-family: var(--font-mono); color: var(--accent); font-weight: 600; }
.cpub-report-card { padding: 16px; border: var(--border-width-default) solid var(--border); background: var(--surface); margin-bottom: 12px; box-shadow: var(--shadow-md); }
.cpub-report-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.cpub-report-checkbox { display: flex; align-items: center; cursor: pointer; }
.cpub-report-checkbox input { cursor: pointer; accent-color: var(--accent); }
.cpub-report-status { font-size: 10px; font-family: var(--font-mono); font-weight: 600; text-transform: uppercase; padding: 2px 8px; }
.cpub-status-pending { background: var(--yellow-bg); color: var(--yellow); border: var(--border-width-default) solid var(--yellow-border); }
.cpub-status-reviewed { background: var(--blue-bg, var(--accent-bg)); color: var(--blue, var(--accent)); border: var(--border-width-default) solid var(--blue-border, var(--accent-border)); }
.cpub-status-resolved { background: var(--green-bg); color: var(--green); border: var(--border-width-default) solid var(--green-border); }
.cpub-status-dismissed { background: var(--surface2); color: var(--text-faint); border: var(--border-width-default) solid var(--border2); }
.cpub-report-type { font-size: 10px; font-family: var(--font-mono); color: var(--accent); background: var(--accent-bg); padding: 2px 6px; border: var(--border-width-default) solid var(--accent-border); }
.cpub-report-date { font-size: 11px; color: var(--text-faint); margin-left: auto; font-family: var(--font-mono); }
.cpub-report-reason { font-size: 13px; margin-bottom: 4px; }
.cpub-report-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; margin-bottom: 8px; }
.cpub-report-meta { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
.cpub-report-meta-item { font-size: 10px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-report-meta-item code { background: var(--surface2); padding: 1px 4px; }
.cpub-report-resolution { font-size: 11px; color: var(--text-dim); font-style: italic; margin-bottom: 8px; }
.cpub-report-resolution i { color: var(--text-faint); margin-right: 4px; }
.cpub-report-actions { display: flex; gap: 6px; padding-top: 8px; border-top: var(--border-width-default) solid var(--border2); }
.cpub-report-select-all { display: flex; align-items: center; gap: 6px; padding: 8px 0; font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.cpub-report-select-all label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.cpub-report-select-all input { cursor: pointer; accent-color: var(--accent); }
.cpub-admin-empty { color: var(--text-faint); text-align: center; padding: var(--space-8) 0; }
</style>
