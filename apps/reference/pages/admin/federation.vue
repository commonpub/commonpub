<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: 'Federation — Admin — CommonPub' });

const activeTab = ref<'activity' | 'mirrors' | 'clients' | 'tools'>('activity');

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

const { data: clientsData } = await useFetch<any[]>('/api/admin/federation/clients', {
  default: () => [],
});

// Mirror creation
const newMirrorDomain = ref('');
const newMirrorActorUri = ref('');
const mirrorCreating = ref(false);

async function createMirror(): Promise<void> {
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

async function toggleMirror(id: string, currentStatus: string): Promise<void> {
  await $fetch(`/api/admin/federation/mirrors/${id}`, {
    method: 'PUT',
    body: { action: currentStatus === 'active' ? 'pause' : 'resume' },
  });
  await refreshMirrors();
}

async function deleteMirror(id: string): Promise<void> {
  await $fetch(`/api/admin/federation/mirrors/${id}`, { method: 'DELETE' });
  await refreshMirrors();
}

// Backfill
const backfilling = ref<string | null>(null);
const backfillResult = ref<{ processed: number; errors: number; pages: number } | null>(null);

async function backfillMirror(id: string): Promise<void> {
  backfilling.value = id;
  backfillResult.value = null;
  try {
    const result = await $fetch<{ processed: number; errors: number; pages: number }>(`/api/admin/federation/mirrors/${id}/backfill`, { method: 'POST' });
    backfillResult.value = result;
    await refreshMirrors();
  } finally {
    backfilling.value = null;
  }
}

// Retry failed activities
const retrying = ref(false);

async function retryFailed(): Promise<void> {
  retrying.value = true;
  try {
    await $fetch('/api/admin/federation/retry', { method: 'POST' });
    window.location.reload();
  } finally {
    retrying.value = false;
  }
}

// Activity filters
const activityFilter = ref<{ direction?: string; status?: string; type?: string }>({});
const filteredActivities = computed(() => {
  const items = (activityData.value?.items ?? []) as Array<{ id: string; direction: string; type: string; actorUri: string; status: string; createdAt: string }>;
  return items.filter((act) => {
    if (activityFilter.value.direction && act.direction !== activityFilter.value.direction) return false;
    if (activityFilter.value.status && act.status !== activityFilter.value.status) return false;
    if (activityFilter.value.type && act.type !== activityFilter.value.type) return false;
    return true;
  });
});

// Tools: pending activities
const pendingData = ref<{ count: number; activities: Array<{ id: string; activityType: string; actorUri: string; objectUri: string; createdAt: string; status: string }> } | null>(null);
const loadingPending = ref(false);

async function loadPending(): Promise<void> {
  loadingPending.value = true;
  try {
    pendingData.value = await ($fetch as Function)('/api/admin/federation/pending');
  } finally {
    loadingPending.value = false;
  }
}

// Tools: repair content types
const repairResult = ref<{ total: number; updated: number; errors: number } | null>(null);
const repairing = ref(false);

async function repairTypes(): Promise<void> {
  repairing.value = true;
  repairResult.value = null;
  try {
    repairResult.value = await ($fetch as Function)('/api/admin/federation/repair-types', { method: 'POST' });
  } finally {
    repairing.value = false;
  }
}

// Tools: re-federate
const refederating = ref(false);
const refederateResult = ref<{ queued: number; content?: number; hubPosts?: number } | null>(null);

async function refederate(): Promise<void> {
  refederating.value = true;
  refederateResult.value = null;
  try {
    refederateResult.value = await ($fetch as Function)('/api/admin/federation/refederate', { method: 'POST' });
  } finally {
    refederating.value = false;
  }
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
      <button :class="{ active: activeTab === 'tools' }" @click="activeTab = 'tools'">Tools</button>
    </div>

    <!-- Activity Tab -->
    <div v-if="activeTab === 'activity'">
      <!-- Filters + Retry -->
      <div class="cpub-fed-form">
        <select v-model="activityFilter.direction" class="cpub-fed-input" style="flex:0 0 auto;width:auto;">
          <option value="">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select v-model="activityFilter.status" class="cpub-fed-input" style="flex:0 0 auto;width:auto;">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
        </select>
        <select v-model="activityFilter.type" class="cpub-fed-input" style="flex:0 0 auto;width:auto;">
          <option value="">All types</option>
          <option value="Create">Create</option>
          <option value="Update">Update</option>
          <option value="Delete">Delete</option>
          <option value="Follow">Follow</option>
          <option value="Accept">Accept</option>
          <option value="Like">Like</option>
          <option value="Announce">Announce</option>
          <option value="Undo">Undo</option>
        </select>
        <button
          v-if="(statsData?.failed ?? 0) > 0"
          class="cpub-fed-btn"
          :disabled="retrying"
          @click="retryFailed"
        >
          {{ retrying ? 'Retrying...' : `Retry ${statsData?.failed ?? 0} Failed` }}
        </button>
      </div>

      <div class="cpub-fed-activity-list">
        <div v-if="!filteredActivities.length" class="cpub-fed-empty">No matching activity.</div>
        <div v-for="act in filteredActivities" :key="act.id" class="cpub-fed-activity-row">
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
          <button
            class="cpub-fed-btn-sm"
            :disabled="backfilling === m.id"
            @click="backfillMirror(m.id)"
          >
            {{ backfilling === m.id ? 'Backfilling...' : 'Backfill' }}
          </button>
          <button class="cpub-fed-btn-sm cpub-fed-btn-danger" @click="deleteMirror(m.id)">Delete</button>
        </div>
      </div>

      <!-- Backfill result -->
      <div v-if="backfillResult" class="cpub-fed-result">
        Backfill complete: {{ backfillResult.processed }} items, {{ backfillResult.errors }} errors, {{ backfillResult.pages }} pages.
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

    <!-- Tools Tab -->
    <div v-if="activeTab === 'tools'">
      <div class="cpub-fed-tools">
        <!-- Pending Activities -->
        <div class="cpub-fed-tool-card">
          <h3 class="cpub-fed-tool-title"><i class="fa-solid fa-clock-rotate-left"></i> Pending Activities</h3>
          <p class="cpub-fed-tool-desc">View outbound activities that haven't been delivered yet. Useful for debugging stuck Delete or Create activities.</p>
          <button class="cpub-fed-btn" :disabled="loadingPending" @click="loadPending">
            {{ loadingPending ? 'Loading...' : 'Load Pending' }}
          </button>
          <div v-if="pendingData" class="cpub-fed-tool-result">
            <p>{{ pendingData.count }} pending activities</p>
            <div v-if="pendingData.activities.length" class="cpub-fed-activity-list" style="margin-top: 8px;">
              <div v-for="act in pendingData.activities" :key="act.id" class="cpub-fed-activity-row">
                <span class="cpub-fed-type">{{ act.activityType }}</span>
                <span class="cpub-fed-actor">{{ act.objectUri }}</span>
                <time class="cpub-fed-time">{{ new Date(act.createdAt).toLocaleString() }}</time>
              </div>
            </div>
          </div>
        </div>

        <!-- Repair Content Types -->
        <div class="cpub-fed-tool-card">
          <h3 class="cpub-fed-tool-title"><i class="fa-solid fa-wrench"></i> Repair Content Types</h3>
          <p class="cpub-fed-tool-desc">Re-fetch source objects for federated content with missing <code>cpub:type</code> and update them. Fixes items backfilled before type extension was added.</p>
          <button class="cpub-fed-btn" :disabled="repairing" @click="repairTypes">
            {{ repairing ? 'Repairing...' : 'Repair Types' }}
          </button>
          <div v-if="repairResult" class="cpub-fed-tool-result">
            Checked {{ repairResult.total }} items, updated {{ repairResult.updated }}, {{ repairResult.errors }} errors.
          </div>
        </div>

        <!-- Re-federate All Content + Hub Posts -->
        <div class="cpub-fed-tool-card">
          <h3 class="cpub-fed-tool-title"><i class="fa-solid fa-rotate"></i> Re-federate All</h3>
          <p class="cpub-fed-tool-desc">Queue all published content (Create) and hub posts (Announce) for re-delivery. Safe to run multiple times.</p>
          <button class="cpub-fed-btn" :disabled="refederating" @click="refederate">
            {{ refederating ? 'Queuing...' : 'Re-federate All' }}
          </button>
          <div v-if="refederateResult" class="cpub-fed-tool-result">
            Queued {{ refederateResult.queued }} items for delivery.
            <span v-if="refederateResult.content !== undefined" style="display: block; font-size: 12px; color: var(--text-faint); margin-top: 4px">
              {{ refederateResult.content }} content + {{ refederateResult.hubPosts ?? 0 }} hub posts
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-admin-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 20px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.04em; }

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
  display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;
}
.cpub-fed-input {
  flex: 1; padding: 8px 12px; font-family: var(--font-mono); font-size: 0.8125rem;
  border: 2px solid var(--border); background: var(--surface); color: var(--text);
}
.cpub-fed-btn {
  padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
  background: var(--accent); color: var(--color-text-inverse); border: 2px solid var(--accent);
  box-shadow: var(--shadow-sm); transition: box-shadow 0.15s, transform 0.15s;
}
.cpub-fed-btn:hover { box-shadow: none; transform: translate(2px, 2px); }
.cpub-fed-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.cpub-fed-btn-sm {
  padding: 2px 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  text-transform: uppercase; cursor: pointer; background: transparent;
  border: 2px solid var(--border); color: var(--text-dim);
}
.cpub-fed-btn-sm:hover { border-color: var(--accent); color: var(--accent); }
.cpub-fed-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-fed-btn-danger:hover { border-color: var(--red); color: var(--red); }

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
.cpub-fed-status.failed { color: var(--red); border-color: var(--red); }
.cpub-fed-time { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); white-space: nowrap; }
.cpub-fed-error { font-size: 10px; color: var(--red); font-family: var(--font-mono); cursor: help; }
.cpub-fed-info-text { font-size: 0.75rem; color: var(--text-dim); margin-top: 12px; }
.cpub-fed-info-text code { font-family: var(--font-mono); background: var(--surface2); padding: 1px 4px; }

.cpub-fed-result {
  margin-top: 8px; padding: 10px 14px; font-size: 0.8125rem; font-family: var(--font-mono);
  background: var(--accent-bg); border: 2px solid var(--accent-border); color: var(--text);
}

/* Tools tab */
.cpub-fed-tools { display: flex; flex-direction: column; gap: 16px; }
.cpub-fed-tool-card {
  padding: 20px; background: var(--surface); border: 2px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.cpub-fed-tool-title {
  font-family: var(--font-mono); font-size: 0.875rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;
  display: flex; align-items: center; gap: 8px;
}
.cpub-fed-tool-title i { color: var(--accent); }
.cpub-fed-tool-desc {
  font-size: 0.8125rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.5;
}
.cpub-fed-tool-desc code { font-family: var(--font-mono); background: var(--surface2); padding: 1px 4px; }
.cpub-fed-tool-result {
  margin-top: 10px; padding: 10px 14px; font-size: 0.8125rem; font-family: var(--font-mono);
  background: var(--accent-bg); border: 2px solid var(--accent-border); color: var(--text);
}
</style>
