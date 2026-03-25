<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: 'Federation — Admin — CommonPub' });

const { data: activityData } = await useFetch('/api/admin/federation/activity', {
  query: { limit: 50 },
  default: () => ({ items: [], total: 0 }),
});

const { data: statsData } = await useFetch('/api/admin/federation/stats', {
  default: () => ({ inbound: 0, outbound: 0, pending: 0, failed: 0, followers: 0, following: 0 }),
});
</script>

<template>
  <div>
    <h1 class="cpub-admin-title">Federation</h1>

    <!-- Stats -->
    <div class="cpub-fed-stats">
      <div class="cpub-fed-stat">
        <span class="cpub-fed-stat-val">{{ statsData?.inbound ?? 0 }}</span>
        <span class="cpub-fed-stat-label">Inbound</span>
      </div>
      <div class="cpub-fed-stat">
        <span class="cpub-fed-stat-val">{{ statsData?.outbound ?? 0 }}</span>
        <span class="cpub-fed-stat-label">Outbound</span>
      </div>
      <div class="cpub-fed-stat">
        <span class="cpub-fed-stat-val">{{ statsData?.pending ?? 0 }}</span>
        <span class="cpub-fed-stat-label">Pending</span>
      </div>
      <div class="cpub-fed-stat">
        <span class="cpub-fed-stat-val">{{ statsData?.failed ?? 0 }}</span>
        <span class="cpub-fed-stat-label">Failed</span>
      </div>
      <div class="cpub-fed-stat">
        <span class="cpub-fed-stat-val">{{ statsData?.followers ?? 0 }}</span>
        <span class="cpub-fed-stat-label">Followers</span>
      </div>
      <div class="cpub-fed-stat">
        <span class="cpub-fed-stat-val">{{ statsData?.following ?? 0 }}</span>
        <span class="cpub-fed-stat-label">Following</span>
      </div>
    </div>

    <div class="cpub-fed-info">
      <p><strong>Protocol:</strong> ActivityPub (HTTP Signatures, draft-cavage-12)</p>
      <p><strong>WebFinger:</strong> <code>/.well-known/webfinger</code></p>
      <p><strong>NodeInfo:</strong> <code>/nodeinfo/2.1</code></p>
    </div>

    <!-- Activity Log -->
    <h2 class="cpub-fed-section-title">Activity Log</h2>
    <div class="cpub-fed-activity-list">
      <div v-if="!activityData?.items?.length" class="cpub-fed-empty">No federation activity yet.</div>
      <div v-for="act in activityData?.items" :key="act.id" class="cpub-fed-activity-row">
        <span class="cpub-fed-dir" :class="act.direction">{{ act.direction === 'inbound' ? 'IN' : 'OUT' }}</span>
        <span class="cpub-fed-type">{{ act.type }}</span>
        <span class="cpub-fed-actor">{{ act.actorUri }}</span>
        <span class="cpub-fed-status" :class="act.status">{{ act.status }}</span>
        <time class="cpub-fed-time">{{ new Date(act.createdAt).toLocaleString() }}</time>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-admin-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 20px; font-family: var(--font-mono); }
.cpub-fed-stats {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; margin-bottom: 24px;
}
.cpub-fed-stat {
  padding: 16px; background: var(--surface); border: 2px solid var(--border);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  box-shadow: 4px 4px 0 var(--border);
}
.cpub-fed-stat-val { font-size: 1.5rem; font-weight: 700; font-family: var(--font-mono); }
.cpub-fed-stat-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-dim); font-family: var(--font-mono);
}

.cpub-fed-info {
  padding: 16px; background: var(--surface); border: 2px solid var(--border);
  margin-bottom: 24px; font-size: 0.8125rem; color: var(--text-dim);
  box-shadow: 4px 4px 0 var(--border);
}
.cpub-fed-info p { margin-bottom: 4px; }
.cpub-fed-info code {
  font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent);
  background: var(--surface2); padding: 1px 4px; border: 1px solid var(--border);
}

.cpub-fed-section-title { font-size: 1rem; font-weight: 700; margin-bottom: 12px; font-family: var(--font-mono); }

.cpub-fed-activity-list {
  border: 2px solid var(--border); overflow: hidden;
  box-shadow: 4px 4px 0 var(--border);
}
.cpub-fed-empty { padding: 24px; text-align: center; color: var(--text-faint); font-size: 0.8125rem; }
.cpub-fed-activity-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-bottom: 2px solid var(--border); font-size: 0.75rem;
}
.cpub-fed-activity-row:last-child { border-bottom: none; }
.cpub-fed-dir {
  font-size: 10px; font-weight: 700; padding: 2px 6px;
  text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-mono);
  border: 2px solid var(--border);
}
.cpub-fed-dir.inbound { background: var(--accent-bg); color: var(--accent); border-color: var(--accent-border); }
.cpub-fed-dir.outbound { background: var(--surface2); color: var(--text-dim); }
.cpub-fed-type { font-weight: 600; color: var(--text); min-width: 60px; font-family: var(--font-mono); }
.cpub-fed-actor { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-fed-status { font-size: 10px; font-weight: 600; padding: 2px 6px; text-transform: uppercase; font-family: var(--font-mono); border: 2px solid var(--border); }
.cpub-fed-status.delivered { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-fed-status.processed { color: var(--accent); background: var(--accent-bg); }
.cpub-fed-status.pending { color: var(--text-dim); }
.cpub-fed-status.failed { color: var(--color-error); }
.cpub-fed-time { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); white-space: nowrap; }
</style>
