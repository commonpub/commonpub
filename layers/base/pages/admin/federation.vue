<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Federation, Admin, ${useSiteName()}` });

const activeTab = ref<'activity' | 'mirrors' | 'registry' | 'clients' | 'trusted' | 'tools'>('activity');

const featureFlags = useFeatures();
const actAsRegistry = computed(() => featureFlags.features.value.actAsRegistry);
const announceToRegistry = computed(() => featureFlags.features.value.announceToRegistry);

const { data: statsData, pending } = await useFetch('/api/admin/federation/stats', {
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

// Trusted instances
const { data: trustedData, refresh: refreshTrusted } = await useFetch<{ configDomains: string[]; storedDomains: string[] }>('/api/admin/federation/trusted-instances', {
  default: () => ({ configDomains: [], storedDomains: [] }),
});

const newTrustedDomain = ref('');
const trustedAdding = ref(false);

async function addTrusted(): Promise<void> {
  const domain = newTrustedDomain.value.trim().toLowerCase();
  if (!domain) return;
  trustedAdding.value = true;
  try {
    await $fetch('/api/admin/federation/trusted-instances', {
      method: 'POST',
      body: { domain },
    });
    newTrustedDomain.value = '';
    await refreshTrusted();
  } finally {
    trustedAdding.value = false;
  }
}

async function removeTrusted(domain: string): Promise<void> {
  try {
    await $fetch('/api/admin/federation/trusted-instances', {
      method: 'DELETE',
      body: { domain },
    });
    await refreshTrusted();
  } catch {
    toast.error('Failed to remove trusted instance');
  }
}

const toast = useToast();

// Instances mirroring US (followers of our instance actor).
const { data: followersData } = await useFetch<Array<{ actorUri: string; domain: string; followedAt: string | null }>>(
  '/api/admin/federation/followers',
  { default: () => [] },
);

// Consent-based mirror requests (Phase 3): incoming = others asking to mirror us; outgoing = us asking them.
type MirrorRequest = { id: string; direction: string; remoteDomain: string; remoteActorUri: string; status: string; createdAt: string; decidedAt: string | null };
const { data: requestsData, refresh: refreshRequests } = await useFetch<{ incoming: MirrorRequest[]; outgoing: MirrorRequest[] }>(
  '/api/admin/federation/mirror-requests',
  { default: () => ({ incoming: [], outgoing: [] }) },
);
const pendingIncoming = computed(() => (requestsData.value?.incoming ?? []).filter((r) => r.status === 'pending'));
const decidedIncoming = computed(() => (requestsData.value?.incoming ?? []).filter((r) => r.status !== 'pending'));
const approvingRequest = ref<MirrorRequest | null>(null);

async function onRequestChanged(): Promise<void> {
  await Promise.all([refreshRequests(), refreshMirrors()]);
}

async function rejectRequest(id: string): Promise<void> {
  const url: string = `/api/admin/federation/mirror-requests/${id}/reject`;
  try {
    await $fetch(url, { method: 'POST' });
    toast.success('Request rejected');
    await refreshRequests();
  } catch {
    toast.error('Failed to reject request');
  }
}

// Registry directory (Phase 4). When this instance ACTS AS a registry, show the
// local directory (with owner hide/block controls). When it only ANNOUNCES to a
// registry, pull that registry's public directory so the operator can still
// discover every peer registered there (read-only). id/status are absent on the
// remote (public) view.
type RegistryRow = { id?: string; domain: string; actorUri: string; name: string | null; description: string | null; userCount: number; activeMonthCount: number; localPostCount: number; softwareName: string | null; softwareVersion: string | null; status?: string; lastPingAt: string | null; online: boolean };
const registrySearch = ref('');
const registryTabAvailable = computed(() => actAsRegistry.value || announceToRegistry.value);
const showRemoteDirectory = computed(() => !actAsRegistry.value && announceToRegistry.value);

const { data: registryData, refresh: refreshRegistry } = await useFetch<{ instances: RegistryRow[]; total: number }>(
  '/api/admin/registry/instances',
  {
    query: computed(() => ({ search: registrySearch.value || undefined, limit: 50 })),
    default: () => ({ instances: [], total: 0 }),
    immediate: actAsRegistry.value,
  },
);

const { data: registryDirData, refresh: refreshRegistryDir } = await useFetch<{ instances: RegistryRow[]; total: number; registryUrl: string | null }>(
  '/api/admin/registry/directory',
  {
    query: computed(() => ({ search: registrySearch.value || undefined })),
    default: () => ({ instances: [], total: 0, registryUrl: null }),
    immediate: showRemoteDirectory.value,
  },
);

const registryInstances = computed<RegistryRow[]>(() =>
  actAsRegistry.value ? (registryData.value?.instances ?? []) : (registryDirData.value?.instances ?? []),
);
const registryLabel = computed<string | null>(() => {
  if (!announceToRegistry.value) return null;
  const url = registryDirData.value?.registryUrl;
  if (showRemoteDirectory.value && url) {
    try { return new URL(url).hostname; } catch { return 'your configured registry'; }
  }
  return 'your configured registry';
});

function onRegistrySearch(value: string): void {
  registrySearch.value = value;
  if (actAsRegistry.value) void refreshRegistry();
  else void refreshRegistryDir();
}

// Mirror creation
const FEDERATABLE_TYPES = ['project', 'blog', 'explainer'] as const;
// Bounded "how far back" choices for the optional history import on create.
const DEPTH_OPTIONS = [
  { label: 'None, forward only (default)', body: null as Record<string, number> | null },
  { label: 'Last 7 days', body: { sinceDays: 7 } },
  { label: 'Last 30 days', body: { sinceDays: 30 } },
  { label: 'Last 90 days', body: { sinceDays: 90 } },
  { label: 'Last 200 items', body: { maxItems: 200 } },
  { label: 'Everything (up to limit)', body: {} },
];

const newMirrorDomain = ref('');
const newMirrorActorUri = ref('');
const newMirrorDirection = ref<'pull' | 'push'>('pull');
const newMirrorTypes = ref<string[]>([]);
const newMirrorTags = ref('');
const newMirrorDepth = ref(0);
const showAdvanced = ref(false);
const mirrorCreating = ref(false);

function resetMirrorForm(): void {
  newMirrorDomain.value = '';
  newMirrorActorUri.value = '';
  newMirrorTypes.value = [];
  newMirrorTags.value = '';
  newMirrorDepth.value = 0;
  showAdvanced.value = false;
}

async function createMirror(): Promise<void> {
  const domain = newMirrorDomain.value.trim().toLowerCase();
  if (!domain) return;
  mirrorCreating.value = true;
  try {
    // Push = consent-based request: ask them to mirror us. No filters/depth here — the approver
    // chooses their own. The request flows to their admin; we track it under "Requests you've sent".
    if (newMirrorDirection.value === 'push') {
      await $fetch('/api/admin/federation/mirrors', {
        method: 'POST',
        body: {
          remoteDomain: domain,
          remoteActorUri: newMirrorActorUri.value.trim() || `https://${domain}/actor`,
          direction: 'push',
        },
      });
      toast.success(`Request sent to ${domain}, they must approve before they mirror you`);
      resetMirrorForm();
      newMirrorDirection.value = 'pull';
      await refreshRequests();
      return;
    }

    const tags = newMirrorTags.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    const created = await $fetch<{ id: string }>('/api/admin/federation/mirrors', {
      method: 'POST',
      body: {
        remoteDomain: domain,
        remoteActorUri: newMirrorActorUri.value.trim() || `https://${domain}/actor`,
        direction: 'pull',
        filterContentTypes: newMirrorTypes.value.length ? newMirrorTypes.value : null,
        filterTags: tags.length ? tags : null,
      },
    });
    // Optional bounded history import — forward-only unless a depth is chosen. The mirror is
    // already created at this point, so a backfill failure must NOT masquerade as create-failure.
    const depth = DEPTH_OPTIONS[newMirrorDepth.value]!.body;
    if (depth && created?.id) {
      // string-typed URL avoids the typed-routes $fetch recursion (TS2321) on dynamic paths.
      const backfillUrl: string = `/api/admin/federation/mirrors/${created.id}/backfill`;
      try {
        const r = await $fetch<{ processed: number }>(backfillUrl, { method: 'POST', body: depth });
        toast.success(`Mirror added, imported ${r?.processed ?? 0} item(s)`);
      } catch {
        toast.error('Mirror added, but history import failed, use Backfill in its details to retry.');
      }
    } else {
      toast.success('Mirror added, new posts will arrive as they publish');
    }
    resetMirrorForm();
    await refreshMirrors();
  } catch {
    toast.error(newMirrorDirection.value === 'push' ? 'Failed to send request' : 'Failed to add mirror');
  } finally {
    mirrorCreating.value = false;
  }
}

function toggleType(t: string): void {
  const i = newMirrorTypes.value.indexOf(t);
  if (i === -1) newMirrorTypes.value.push(t);
  else newMirrorTypes.value.splice(i, 1);
}

async function toggleMirror(id: string, currentStatus: string): Promise<void> {
  try {
    await $fetch(`/api/admin/federation/mirrors/${id}`, {
      method: 'PUT',
      body: { action: currentStatus === 'active' ? 'pause' : 'resume' },
    });
    await refreshMirrors();
  } catch {
    toast.error('Failed to update mirror');
  }
}

// Mirror detail modal — per-mirror info + bounded re-backfill + delete.
type MirrorRow = { id: string; status: string; direction: string; remoteDomain: string; remoteActorUri: string; filterContentTypes: string[] | null; filterTags: string[] | null; contentCount: number; errorCount: number; lastError: string | null; lastSyncAt: string | null; backfillCursor?: string | null };
const selectedMirror = ref<MirrorRow | null>(null);

async function onMirrorChanged(): Promise<void> {
  await refreshMirrors();
  if (selectedMirror.value) {
    selectedMirror.value = (mirrorsData.value ?? []).find((m) => m.id === selectedMirror.value!.id) ?? null;
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

// Tools: re-federate (bounded by default to avoid blasting every follower with thousands).
const refederating = ref(false);
const refederateScope = ref<'7' | '30' | 'all'>('30');
const refederateResult = ref<{ queued: number; content?: number; hubs?: number; hubsFound?: number; hubPosts?: number } | null>(null);

async function refederate(): Promise<void> {
  refederating.value = true;
  refederateResult.value = null;
  try {
    const body = refederateScope.value === 'all'
      ? { all: true }
      : { sinceDays: Number(refederateScope.value) };
    refederateResult.value = await ($fetch as Function)('/api/admin/federation/refederate', { method: 'POST', body });
  } finally {
    refederating.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="cpub-admin-title">Federation</h1>

    <!-- Loading -->
    <div v-if="pending" class="cpub-fed-loading">
      <i class="fa-solid fa-circle-notch fa-spin"></i> Loading...
    </div>
    <template v-else>

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
      <button v-if="registryTabAvailable" :class="{ active: activeTab === 'registry' }" @click="activeTab = 'registry'">Registry</button>
      <button :class="{ active: activeTab === 'clients' }" @click="activeTab = 'clients'">OAuth Clients</button>
      <button :class="{ active: activeTab === 'trusted' }" @click="activeTab = 'trusted'">Trusted Instances</button>
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
      <p class="cpub-fed-explain">
        A <strong>mirror</strong> pulls another instance's public content into your federated feed.
        It's <strong>one-directional</strong>, you receive their posts; they receive nothing from
        you and need do nothing. New posts arrive automatically once added; use <strong>Import
        history</strong> to also pull older posts (bounded, so you don't ingest an entire large
        instance at once).
      </p>

      <!-- Create form -->
      <div class="cpub-fed-create">
        <div class="cpub-fed-form" style="margin-bottom: 8px;">
          <select v-model="newMirrorDirection" class="cpub-fed-input" style="flex:0 0 auto;width:auto;" aria-label="Direction">
            <option value="pull">Mirror them (pull)</option>
            <option value="push">Request they mirror you</option>
          </select>
          <input v-model="newMirrorDomain" placeholder="remote-instance.com" class="cpub-fed-input" @keydown.enter.prevent="createMirror" />
          <select v-if="newMirrorDirection === 'pull'" v-model.number="newMirrorDepth" class="cpub-fed-input" style="flex:0 0 auto;width:auto;" aria-label="Import history depth">
            <option v-for="(opt, i) in DEPTH_OPTIONS" :key="i" :value="i">{{ opt.label }}</option>
          </select>
          <button :disabled="mirrorCreating || !newMirrorDomain.trim()" class="cpub-fed-btn" @click="createMirror">
            {{ mirrorCreating ? (newMirrorDirection === 'push' ? 'Sending…' : 'Adding…') : (newMirrorDirection === 'push' ? 'Send Request' : 'Add Mirror') }}
          </button>
        </div>
        <p v-if="newMirrorDirection === 'push'" class="cpub-fed-info-text" style="margin: 0 0 8px;">
          Sends a request asking <strong>{{ newMirrorDomain.trim() || 'the remote instance' }}</strong> to pull-mirror you.
          Their admin must approve (CommonPub instances only). You'll see the status under <strong>Requests you've sent</strong>.
        </p>
        <button v-if="newMirrorDirection === 'pull'" type="button" class="cpub-fed-disclosure" :aria-expanded="showAdvanced" @click="showAdvanced = !showAdvanced">
          <i class="fa-solid" :class="showAdvanced ? 'fa-chevron-down' : 'fa-chevron-right'"></i> Filters &amp; advanced
        </button>
        <div v-if="showAdvanced" class="cpub-fed-advanced">
          <span class="cpub-fed-adv-label">Content types <span class="cpub-fed-adv-faint">(none = all)</span></span>
          <div class="cpub-fed-checks">
            <label v-for="t in FEDERATABLE_TYPES" :key="t" class="cpub-fed-check">
              <input type="checkbox" :checked="newMirrorTypes.includes(t)" @change="toggleType(t)" /> {{ t }}
            </label>
          </div>
          <label class="cpub-fed-adv-label" for="cpub-fed-tags">Tags <span class="cpub-fed-adv-faint">(comma-separated, none = all)</span></label>
          <input id="cpub-fed-tags" v-model="newMirrorTags" placeholder="arduino, 3dprinting" class="cpub-fed-input" style="width:100%;" />
          <label class="cpub-fed-adv-label" for="cpub-fed-actor">Actor URI <span class="cpub-fed-adv-faint">(defaults to https://domain/actor)</span></label>
          <input id="cpub-fed-actor" v-model="newMirrorActorUri" placeholder="https://remote-instance.com/actor" class="cpub-fed-input" style="width:100%;" />
        </div>
      </div>

      <!-- Status legend -->
      <div class="cpub-fed-legend">
        <span><span class="cpub-fed-status active">active</span> receiving</span>
        <span><span class="cpub-fed-status paused">paused</span> stopped, kept</span>
        <span><span class="cpub-fed-status pending">pending</span> follow not yet accepted</span>
        <span><span class="cpub-fed-status failed">failed</span> last sync errored</span>
      </div>

      <!-- Mirror list -->
      <div class="cpub-fed-activity-list">
        <div v-if="!mirrorsData?.length" class="cpub-fed-empty">No mirrors configured.</div>
        <div v-for="m in mirrorsData" :key="m.id" class="cpub-fed-activity-row">
          <span class="cpub-fed-status" :class="m.status">{{ m.status }}</span>
          <span class="cpub-fed-dir-arrow" title="pull (you receive their content)">↓</span>
          <button class="cpub-fed-mirror-name" @click="selectedMirror = m">{{ m.remoteDomain }}</button>
          <span class="cpub-fed-actor">{{ m.contentCount }} items<template v-if="m.filterContentTypes?.length"> · {{ m.filterContentTypes.join(', ') }}</template><template v-if="m.filterTags?.length"> · #{{ m.filterTags.join(' #') }}</template></span>
          <span v-if="m.errorCount > 0" class="cpub-fed-error" :title="m.lastError || ''">{{ m.errorCount }} err</span>
          <time v-if="m.lastSyncAt" class="cpub-fed-time">{{ new Date(m.lastSyncAt).toLocaleDateString() }}</time>
          <button class="cpub-fed-btn-sm" @click="toggleMirror(m.id, m.status)">{{ m.status === 'active' ? 'Pause' : 'Resume' }}</button>
          <button class="cpub-fed-btn-sm" @click="selectedMirror = m">Details</button>
        </div>
      </div>

      <!-- Instances mirroring you -->
      <h3 class="cpub-fed-subhead">Instances mirroring you</h3>
      <p class="cpub-fed-info-text" style="margin-bottom: 8px;">Remote instances following your instance actor, they pull your public content. (One-directional: you don't pull them unless you add a mirror above.)</p>
      <div class="cpub-fed-activity-list">
        <div v-if="!followersData?.length" class="cpub-fed-empty">No instances are mirroring you yet.</div>
        <div v-for="f in followersData" :key="f.actorUri" class="cpub-fed-activity-row">
          <span class="cpub-fed-dir-arrow" title="they pull from you">↗</span>
          <span class="cpub-fed-type">{{ f.domain }}</span>
          <span class="cpub-fed-actor">{{ f.actorUri }}</span>
          <time v-if="f.followedAt" class="cpub-fed-time">{{ new Date(f.followedAt).toLocaleDateString() }}</time>
        </div>
      </div>

      <!-- Requests to mirror you (incoming) -->
      <h3 class="cpub-fed-subhead">Requests to mirror you</h3>
      <p class="cpub-fed-info-text" style="margin-bottom: 8px;">Other CommonPub instances asking you to let them pull-mirror your content. Approve to start mirroring them back (you choose depth + filters), or reject.</p>
      <div class="cpub-fed-activity-list">
        <div v-if="!pendingIncoming.length && !decidedIncoming.length" class="cpub-fed-empty">No incoming mirror requests.</div>
        <div v-for="r in pendingIncoming" :key="r.id" class="cpub-fed-activity-row">
          <span class="cpub-fed-status pending">pending</span>
          <span class="cpub-fed-type">{{ r.remoteDomain }}</span>
          <span class="cpub-fed-actor">{{ r.remoteActorUri }}</span>
          <time class="cpub-fed-time">{{ new Date(r.createdAt).toLocaleDateString() }}</time>
          <button class="cpub-fed-btn-sm" @click="approvingRequest = r">Review</button>
          <button class="cpub-fed-btn-sm cpub-fed-btn-danger" @click="rejectRequest(r.id)">Reject</button>
        </div>
        <div v-for="r in decidedIncoming" :key="r.id" class="cpub-fed-activity-row">
          <span class="cpub-fed-status" :class="r.status === 'approved' ? 'active' : 'failed'">{{ r.status }}</span>
          <span class="cpub-fed-type">{{ r.remoteDomain }}</span>
          <span class="cpub-fed-actor">{{ r.remoteActorUri }}</span>
          <time v-if="r.decidedAt" class="cpub-fed-time">{{ new Date(r.decidedAt).toLocaleDateString() }}</time>
        </div>
      </div>

      <!-- Requests you've sent (outgoing) -->
      <h3 class="cpub-fed-subhead">Requests you've sent</h3>
      <p class="cpub-fed-info-text" style="margin-bottom: 8px;">Instances you've asked to mirror you ("Request they mirror you" above). They start mirroring once their admin approves.</p>
      <div class="cpub-fed-activity-list">
        <div v-if="!requestsData?.outgoing?.length" class="cpub-fed-empty">No outgoing requests.</div>
        <div v-for="r in requestsData?.outgoing ?? []" :key="r.id" class="cpub-fed-activity-row">
          <span class="cpub-fed-status" :class="r.status === 'approved' ? 'active' : r.status === 'rejected' ? 'failed' : 'pending'">{{ r.status }}</span>
          <span class="cpub-fed-dir-arrow" title="you asked them to mirror you">↑</span>
          <span class="cpub-fed-type">{{ r.remoteDomain }}</span>
          <time class="cpub-fed-time">{{ new Date(r.createdAt).toLocaleDateString() }}</time>
        </div>
      </div>
    </div>

    <!-- Registry Tab -->
    <div v-if="activeTab === 'registry' && registryTabAvailable">
      <RegistryDirectory
        :instances="registryInstances"
        :readonly-mode="showRemoteDirectory"
        :announcing-to="registryLabel"
        @changed="refreshMirrors"
        @search="onRegistrySearch"
      />
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

    <!-- Trusted Instances Tab -->
    <div v-if="activeTab === 'trusted'">
      <p class="cpub-fed-info-text" style="margin-bottom: 12px;">
        Trusted instances can use cross-instance SSO to authenticate users on this instance.
        Domains from the config file cannot be removed here.
      </p>

      <div class="cpub-fed-form">
        <input v-model="newTrustedDomain" placeholder="instance.example.com" class="cpub-fed-input" @keydown.enter.prevent="addTrusted" />
        <button :disabled="trustedAdding || !newTrustedDomain.trim()" class="cpub-fed-btn" @click="addTrusted">
          {{ trustedAdding ? 'Adding...' : 'Add Instance' }}
        </button>
      </div>

      <div class="cpub-fed-activity-list">
        <div v-if="!trustedData.configDomains.length && !trustedData.storedDomains.length" class="cpub-fed-empty">No trusted instances configured.</div>

        <div v-for="domain in trustedData.configDomains" :key="'config-' + domain" class="cpub-fed-activity-row">
          <span class="cpub-fed-type">{{ domain }}</span>
          <span class="cpub-fed-status processed">config</span>
        </div>

        <div v-for="domain in trustedData.storedDomains" :key="'stored-' + domain" class="cpub-fed-activity-row">
          <span class="cpub-fed-type">{{ domain }}</span>
          <span class="cpub-fed-status pending">admin</span>
          <button class="cpub-fed-btn-sm cpub-fed-btn-danger" @click="removeTrusted(domain)">Remove</button>
        </div>
      </div>
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

        <!-- Re-federate Content + Hub Posts -->
        <div class="cpub-fed-tool-card">
          <h3 class="cpub-fed-tool-title"><i class="fa-solid fa-rotate"></i> Re-federate</h3>
          <p class="cpub-fed-tool-desc">Re-queue your published content (Create) and hub posts (Announce) for delivery to your current followers. Idempotent. <strong>Bounded by default</strong> so you don't blast every follower with thousands of activities, choose how far back.</p>
          <div class="cpub-fed-form">
            <select v-model="refederateScope" class="cpub-fed-input" style="flex:0 0 auto;width:auto;" aria-label="Re-federate scope">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">Everything</option>
            </select>
            <button class="cpub-fed-btn" :disabled="refederating" @click="refederate">
              {{ refederating ? 'Queuing…' : 'Re-federate' }}
            </button>
          </div>
          <div v-if="refederateResult" class="cpub-fed-tool-result">
            Queued {{ refederateResult.queued }} items for delivery.
            <span v-if="refederateResult.content !== undefined" style="display: block; font-size: 12px; color: var(--text-faint); margin-top: 4px">
              {{ refederateResult.content }} content, {{ refederateResult.hubs ?? 0 }}/{{ refederateResult.hubsFound ?? '?' }} hubs announced, {{ refederateResult.hubPosts ?? 0 }} hub posts
            </span>
          </div>
        </div>
      </div>
    </div>
    </template>

    <MirrorDetailModal
      v-if="selectedMirror"
      :mirror="selectedMirror"
      @close="selectedMirror = null"
      @changed="onMirrorChanged"
    />

    <MirrorRequestApproveModal
      v-if="approvingRequest"
      :request="approvingRequest"
      @close="approvingRequest = null"
      @changed="onRequestChanged"
    />
  </div>
</template>

<style scoped>
.cpub-fed-loading { display: flex; align-items: center; gap: 8px; padding: 32px; color: var(--text-faint); font-family: var(--font-mono); font-size: 0.8125rem; }
.cpub-admin-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 20px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.04em; }

.cpub-fed-stats {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; margin-bottom: 24px;
}
.cpub-fed-stat {
  padding: 16px; background: var(--surface); border: var(--border-width-default) solid var(--border);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  box-shadow: var(--shadow-md);
}
.cpub-fed-stat-val { font-size: 1.5rem; font-weight: 700; font-family: var(--font-mono); }
.cpub-fed-stat-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-dim); font-family: var(--font-mono);
}

.cpub-fed-tabs {
  display: flex; gap: 0; margin-bottom: 16px; border-bottom: var(--border-width-default) solid var(--border);
}
.cpub-fed-tabs button {
  padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
  background: transparent; border: none; color: var(--text-dim);
  border-bottom: var(--border-width-default) solid transparent; margin-bottom: -2px;
}
.cpub-fed-tabs button.active {
  color: var(--accent); border-bottom-color: var(--accent);
}

.cpub-fed-form {
  display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;
}
.cpub-fed-input {
  flex: 1; padding: 8px 12px; font-family: var(--font-mono); font-size: 0.8125rem;
  border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text);
}
.cpub-fed-btn {
  padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer;
  background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--accent);
  box-shadow: var(--shadow-sm); transition: box-shadow 0.15s, transform 0.15s;
}
.cpub-fed-btn:hover { box-shadow: none; transform: translate(2px, 2px); }
.cpub-fed-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.cpub-fed-btn-sm {
  padding: 2px 8px; font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  text-transform: uppercase; cursor: pointer; background: transparent;
  border: var(--border-width-default) solid var(--border); color: var(--text-dim);
}
.cpub-fed-btn-sm:hover { border-color: var(--accent); color: var(--accent); }
.cpub-fed-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-fed-btn-danger:hover { border-color: var(--red); color: var(--red-text); }

.cpub-fed-activity-list {
  border: var(--border-width-default) solid var(--border); overflow: hidden;
  box-shadow: var(--shadow-md);
}
.cpub-fed-empty { padding: 24px; text-align: center; color: var(--text-faint); font-size: 0.8125rem; }
.cpub-fed-activity-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  border-bottom: var(--border-width-default) solid var(--border); font-size: 0.75rem;
}
.cpub-fed-activity-row:last-child { border-bottom: none; }
.cpub-fed-dir {
  font-size: 10px; font-weight: 700; padding: 2px 6px;
  text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-mono);
  border: var(--border-width-default) solid var(--border);
}
.cpub-fed-dir.inbound { background: var(--accent-bg); color: var(--accent); border-color: var(--accent-border); }
.cpub-fed-dir.outbound { background: var(--surface2); color: var(--text-dim); }
.cpub-fed-type { font-weight: 600; color: var(--text); min-width: 60px; font-family: var(--font-mono); }
.cpub-fed-actor { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-dim); font-family: var(--font-mono); }
.cpub-fed-status { font-size: 10px; font-weight: 600; padding: 2px 6px; text-transform: uppercase; font-family: var(--font-mono); border: var(--border-width-default) solid var(--border); }
.cpub-fed-status.delivered, .cpub-fed-status.processed, .cpub-fed-status.active { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.cpub-fed-status.pending { color: var(--text-dim); }
.cpub-fed-status.paused { color: var(--text-dim); background: var(--surface2); }
.cpub-fed-status.failed { color: var(--red-text); border-color: var(--red); }
.cpub-fed-time { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); white-space: nowrap; }
.cpub-fed-error { font-size: 10px; color: var(--red-text); font-family: var(--font-mono); cursor: help; }
.cpub-fed-info-text { font-size: 0.75rem; color: var(--text-dim); margin-top: 12px; }
.cpub-fed-info-text code { font-family: var(--font-mono); background: var(--surface2); padding: 1px 4px; }

/* Mirrors tab — explainer, create form, legend, list extras */
.cpub-fed-explain { font-size: 0.8125rem; color: var(--text-dim); line-height: 1.6; margin-bottom: 16px; }
.cpub-fed-create { margin-bottom: 16px; }
.cpub-fed-disclosure {
  background: none; border: none; cursor: pointer; padding: 2px 0;
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-dim); display: flex; align-items: center; gap: 6px;
}
.cpub-fed-disclosure:hover { color: var(--accent); }
.cpub-fed-advanced {
  margin-top: 10px; padding: 12px; border: var(--border-width-default) solid var(--border);
  background: var(--surface2); display: flex; flex-direction: column; gap: 6px;
}
.cpub-fed-adv-label { font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); margin-top: 6px; }
.cpub-fed-adv-faint { color: var(--text-faint); font-weight: 400; text-transform: none; letter-spacing: 0; }
.cpub-fed-checks { display: flex; gap: 12px; flex-wrap: wrap; }
.cpub-fed-check { display: flex; align-items: center; gap: 5px; font-size: 0.8125rem; font-family: var(--font-mono); cursor: pointer; }
.cpub-fed-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; font-size: 0.75rem; color: var(--text-dim); align-items: center; }
.cpub-fed-legend > span { display: flex; align-items: center; gap: 6px; }
.cpub-fed-dir-arrow { font-weight: 700; color: var(--accent); font-family: var(--font-mono); min-width: 12px; text-align: center; }
.cpub-fed-mirror-name {
  background: none; border: none; cursor: pointer; padding: 0; text-align: left;
  font-weight: 600; color: var(--text); min-width: 60px; font-family: var(--font-mono); font-size: 0.75rem;
}
.cpub-fed-mirror-name:hover { color: var(--accent); text-decoration: underline; }
.cpub-fed-subhead {
  font-family: var(--font-mono); font-size: 0.8125rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; margin: 24px 0 4px;
}

.cpub-fed-result {
  margin-top: 8px; padding: 10px 14px; font-size: 0.8125rem; font-family: var(--font-mono);
  background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); color: var(--text);
}

/* Tools tab */
.cpub-fed-tools { display: flex; flex-direction: column; gap: 16px; }
.cpub-fed-tool-card {
  padding: 20px; background: var(--surface); border: var(--border-width-default) solid var(--border);
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
  background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); color: var(--text);
}

/* Mobile — admin federation dashboard. The stats grid (4 cells × 100px min)
   plus 24px gap claims the entire 375px viewport with nothing left for
   labels. The form wraps each input + button onto its own line. The
   activity-list rows shrink to legible. */
@media (max-width: 768px) {
  .cpub-fed-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
  .cpub-fed-stat { padding: 12px 10px; }
  .cpub-fed-stat-val { font-size: 1.25rem; }
  .cpub-fed-tabs { overflow-x: auto; }
  .cpub-fed-tabs button { padding: 8px 12px; white-space: nowrap; }
  .cpub-fed-form { flex-direction: column; align-items: stretch; gap: 8px; }
  .cpub-fed-form .cpub-fed-btn,
  .cpub-fed-form .cpub-fed-input { width: 100%; }
  .cpub-fed-actor { font-size: 11px; }
  .cpub-fed-time { font-size: 9px; }
  .cpub-admin-title { font-size: 1rem; }
}
</style>
