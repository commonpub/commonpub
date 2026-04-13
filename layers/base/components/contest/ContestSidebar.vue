<script setup lang="ts">
import type { Serialized, ContestDetail } from '@commonpub/server';

defineProps<{
  contest: Serialized<ContestDetail> | null;
}>();

const emit = defineEmits<{
  (e: 'copy-link'): void;
}>();

function statusClass(status: string): string {
  const map: Record<string, string> = {
    upcoming: 'cpub-status-upcoming',
    active: 'cpub-status-active',
    judging: 'cpub-status-judging',
    completed: 'cpub-status-completed',
    cancelled: 'cpub-status-cancelled',
  };
  return map[status] ?? '';
}
</script>

<template>
  <div class="cpub-sidebar">
    <!-- STATUS -->
    <div class="cpub-sb-card">
      <div class="cpub-sb-title"><i class="fa-solid fa-circle-info"></i> Status</div>
      <div class="cpub-sb-body">
        <div class="cpub-sb-row">
          <strong>Status:</strong>
          <span class="cpub-sb-status" :class="statusClass(contest?.status ?? '')">{{ contest?.status ?? 'unknown' }}</span>
        </div>
        <div v-if="contest?.startDate" class="cpub-sb-row"><strong>Starts:</strong> {{ new Date(contest.startDate).toLocaleDateString() }}</div>
        <div v-if="contest?.endDate" class="cpub-sb-row"><strong>Ends:</strong> {{ new Date(contest.endDate).toLocaleDateString() }}</div>
        <div v-if="contest?.judgingEndDate" class="cpub-sb-row"><strong>Judging ends:</strong> {{ new Date(contest.judgingEndDate).toLocaleDateString() }}</div>
        <div class="cpub-sb-row"><strong>Entries:</strong> {{ contest?.entryCount ?? 0 }}</div>
      </div>
    </div>

    <!-- LINKS -->
    <div class="cpub-sb-card">
      <div class="cpub-sb-title"><i class="fa-solid fa-share-nodes"></i> Share</div>
      <div class="cpub-sb-actions">
        <button class="cpub-btn cpub-btn-sm cpub-sb-btn" @click="emit('copy-link')"><i class="fa fa-link"></i> Copy Link</button>
      </div>
    </div>

    <NuxtLink v-if="contest?.status === 'completed'" :to="`/contests/${contest.slug}/results`" class="cpub-btn cpub-sb-link">
      <i class="fa-solid fa-ranking-star"></i> View Results
    </NuxtLink>

    <NuxtLink to="/contests" class="cpub-btn cpub-sb-link"><i class="fa fa-arrow-left"></i> All Contests</NuxtLink>
  </div>
</template>

<style scoped>
.cpub-sb-card { background: var(--surface); border: var(--border-width-default) solid var(--border); border-radius: var(--radius); padding: 14px; margin-bottom: 12px; box-shadow: var(--shadow-md); }
.cpub-sb-title { font-size: 11px; font-weight: 700; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
.cpub-sb-body { font-size: 12px; color: var(--text-dim); display: flex; flex-direction: column; gap: 8px; }
.cpub-sb-row { display: flex; align-items: center; gap: 6px; }
.cpub-sb-status { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; border: var(--border-width-default) solid; }
.cpub-status-upcoming { color: var(--yellow); border-color: var(--yellow-border); background: var(--yellow-bg); }
.cpub-status-active { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.cpub-status-judging { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-status-completed { color: var(--text-faint); border-color: var(--border2); background: var(--surface2); }
.cpub-status-cancelled { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }

.cpub-sb-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.cpub-sb-btn { flex: 1; justify-content: center; }
.cpub-sb-link { width: 100%; text-align: center; display: block; margin-top: 12px; }
</style>
