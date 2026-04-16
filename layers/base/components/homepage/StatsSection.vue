<script setup lang="ts">
const { hubs: hubsEnabled } = useFeatures();
const { data: stats, pending } = await useFetch('/api/stats', { lazy: true });
</script>

<template>
  <div class="cpub-sb-card">
    <div class="cpub-sb-head">Platform Stats</div>
    <div v-if="pending" class="cpub-loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i></div>
    <div v-else class="cpub-stats-grid">
      <div class="cpub-stat-block">
        <span class="cpub-stat-num">{{ stats?.content?.byType?.project ?? 0 }}</span>
        <span class="cpub-stat-lbl">Projects</span>
      </div>
      <div class="cpub-stat-block">
        <span class="cpub-stat-num">{{ (stats?.content?.byType?.blog ?? 0) + (stats?.content?.byType?.article ?? 0) }}</span>
        <span class="cpub-stat-lbl">Posts</span>
      </div>
      <div class="cpub-stat-block">
        <span class="cpub-stat-num">{{ stats?.users?.total ?? 0 }}</span>
        <span class="cpub-stat-lbl">Members</span>
      </div>
      <div v-if="hubsEnabled" class="cpub-stat-block">
        <span class="cpub-stat-num">{{ stats?.hubs?.total ?? 0 }}</span>
        <span class="cpub-stat-lbl">Hubs</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-sb-card { background: var(--surface); border: var(--border-width-default) solid var(--border); padding: 16px; margin-bottom: 16px; }
.cpub-sb-head { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); padding-bottom: 10px; border-bottom: var(--border-width-default) solid var(--border2); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
.cpub-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.cpub-stat-block { text-align: center; padding: 8px 0; }
.cpub-stat-num { display: block; font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--text); }
.cpub-stat-lbl { display: block; font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
</style>
