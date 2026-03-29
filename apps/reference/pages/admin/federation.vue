<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: 'Federation — Admin — CommonPub' });

const activeTab = ref<'activity' | 'mirrors' | 'clients'>('activity');

const { data: statsData } = await useFetch('/api/admin/federation/stats', {
  default: () => ({ inbound: 0, outbound: 0, pending: 0, failed: 0, followers: 0, following: 0 }),
});

const { data: activityData } = await useFetch('/api/admin/federation/activity', {
  query: { limit: 50 },
  default: () => ({ items: [], total: 0 }),
});

const { data: mirrorsData, refresh: refreshMirrors } = await useFetch<any[]>('/api/admin/federation/mirrors', {
  default: () => [],
});

const { data: clientsData, refresh: refreshClients } = await useFetch<any[]>('/api/admin/federation/clients', {
  default: () => [],
});

// Mirror creation
const newMirrorDomain = ref('');
const newMirrorActorUri = ref('');
const mirrorCreating = ref(false);

async function createMirror() {
  if (!newMirrorDomain.value) return;
  mirrorCreating.value = true;
  try {
    await $fetch('/api/admin/federation/mirrors', {
      method: 'POST',
      body: {
        remoteDomain: newMirrorDomain.value,
        remoteActorUri: newMirrorActorUri.value || `https://${newMirrorDomain.value}/actor`,
        direction: 'pull',
      },
    });
    newMirrorDomain.value = '';
    newMirrorActorUri.value = '';
    await refreshMirrors();
  } finally {
    mirrorCreating.value = false;
  }
}

async function toggleMirror(id: string, currentStatus: string) {
  await $fetch(`/api/admin/federation/mirrors/${id}`, {
    method: 'PUT',
    body: { action: currentStatus === 'active' ? 'pause' : 'resume' },
  });
  await refreshMirrors();
}

async function deleteMirror(id: string) {
  await $fetch(`/api/admin/federation/mirrors/${id}`, { method: 'DELETE' });
  await refreshMirrors();
}
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

    <!-- Tabs -->
    <div class="cpub-fed-tabs">
      <button :class="{ active: activeTab === 'activity' }" @click="activeTab = 'activity'">Activity</button>
      <button :class="{ active: activeTab === 'mirrors' }" @click="activeTab = 'mirrors'">Mirrors</button>
      <button :class="{ active: activeTab === 'clients' }" @click="activeTab = 'clients'">OAuth Clients</button>
    </div>

    <!-- Activity Tab -->
    <div v-if="activeTab === 'activity'">
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

    <!-- Mirrors Tab -->
    <div v-if="activeTab === 'mirrors'">
      <div class="cpub-fed-form">
        <input v-model="newMirrorDomain" placeholder="remote-instance.com" class="cpub-fed-input" />
        <button :disabled="mirrorCreating || !newMirrorDomain" class="cpub-fed-btn" @click="createMirror">
          {{ mirrorCreating ? 'Creating...' : 'Add Mirror' }}
        </button>
      </div>

      <div class="cpub-fed-activity-list">
        <div v-if="!mirrorsData?.length" class="cpub-fed-empty">No mirrors configured.</div>
        <div v-for="m in mirrorsData" :key="m.id" class="cpub-fed-activity-row">
          <span class="cpub-fed-status" :class="m.status">{{ m.status }}</span>
          <span class="cpub-fed-type">{{ m.remoteDomain }}</span>
          <span class="cpub-fed-actor">{{ m.contentCount }} items</span>
          <span v-if="m.lastError" class="cpub-fed-error" :title="m.lastError">err</span>
          <button class="cpub-fed-btn-sm" @click="toggleMirror(m.id, m.status)">
            {{ m.status === 'active' ? 'Pause' : 'Resume' }}
          </button>
          <button class="cpub-fed-btn-sm cpub-fed-btn-danger" @click="deleteMirror(m.id)">Delete</button>
        </div>
      </div>
    </div>

    <!-- OAuth Clients Tab -->
    <div v-if="activeTab === 'clients'">
      <div class="cpub-fed-activity-list">
        <div v-if="!clientsData?.length" class="cpub-fed-empty">No OAuth clients registered.</div>
        <div v-for="c in clientsData" :key="c.id" class="cpub-fed-activity-row">
          <span class="cpub-fed-type">{{ c.instanceDomain }}</span>
          <span class="cpub-fed-actor">{{ c.clientId }}</span>
          <time class="cpub-fed-time">{{ new Date(c.createdAt).toLocaleString() }}</time>
        </div>
      </div>
      <p class="cpub-fed-info-text">
        Clients are auto-registered via the <code>/api/auth/oauth2/register</code> endpoint.
      </p>
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
  box-shadow: var(--shadow-md);
}
.cpub-fed-stat-val { font-size: 1.5rem; font-weight: 700; font-family: var(--font-mono); }
.cpub-fed-stat-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-dim); font-family: var(--font-mono);
}

.cpub-fed-tabs {
  display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid var(--border);
}
.cpub-fed-tabs button {
  padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
  background: transparent; border: none; color: var(--text-dim);
  border-bottom: 2px solid transparent; margin-bottom: -2px;
}
.cpub-fed-tabs button.active {
  color: var(--accent); border-bottom-color: var(--accent);
}

.cpub-fed-form {
  display: flex; gap: 8px; margin-bottom: 16px;
}
.cpub-fed-input {
  flex: 1; padding: 8px 12px; font-family: var(--font-mono); font-size: 0.8125rem;
  border: 2px solid var(--border); background: var(--surface); color: var(--text);
}
.cpub-fed-btn {
  padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
  background: var(--accent); color: var(--surface); border: 2px solid var(--accent);
}
.cpub-fed-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-fed-btn-sm {
  padding: 2px 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  text-transform: uppercase; cursor: pointer; background: transparent;
  border: 2px solid var(--border); color: var(--text-dim);
}
.cpub-fed-btn-sm:hover { border-color: var(--accent); color: var(--accent); }
.cpub-fed-btn-danger:hover { border-color: var(--color-error); color: var(--color-error); }

.cpub-fed-activity-list {
  border: 2px solid var(--border); overflow: hidden;
  box-shadow: var(--shadow-md);
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
.cpub-fed-status.delivered, .cpub-fed-status.processed, .cpub-fed-status.active { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-fed-status.pending { color: var(--text-dim); }
.cpub-fed-status.paused { color: var(--text-dim); background: var(--surface2); }
.cpub-fed-status.failed { color: var(--color-error); }
.cpub-fed-time { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); white-space: nowrap; }
.cpub-fed-error { font-size: 10px; color: var(--color-error); font-family: var(--font-mono); cursor: help; }
.cpub-fed-info-text { font-size: 0.75rem; color: var(--text-dim); margin-top: 12px; }
.cpub-fed-info-text code { font-family: var(--font-mono); background: var(--surface2); padding: 1px 4px; }
</style>
