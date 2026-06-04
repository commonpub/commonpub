<script setup lang="ts">
interface RegistryRow {
  id: string;
  domain: string;
  actorUri: string;
  name: string | null;
  description: string | null;
  userCount: number;
  activeMonthCount: number;
  localPostCount: number;
  softwareName: string | null;
  softwareVersion: string | null;
  status: string;
  lastPingAt: string | null;
  online: boolean;
}

defineProps<{ instances: RegistryRow[]; announcingTo?: string | null }>();
const emit = defineEmits<{ changed: []; search: [value: string] }>();

const toast = useToast();
const searchTerm = ref('');
const busyId = ref<string | null>(null);

function onSearch(): void {
  emit('search', searchTerm.value.trim());
}

async function mirror(row: RegistryRow, direction: 'pull' | 'push'): Promise<void> {
  busyId.value = row.id;
  try {
    await $fetch('/api/admin/federation/mirrors', {
      method: 'POST',
      body: { remoteDomain: row.domain, remoteActorUri: row.actorUri, direction },
    });
    toast.success(direction === 'pull'
      ? `Mirroring ${row.domain}, their posts will arrive`
      : `Requested ${row.domain} to mirror you, awaiting their approval`);
    emit('changed');
  } catch {
    toast.error(direction === 'pull' ? 'Failed to add mirror' : 'Failed to send request');
  } finally {
    busyId.value = null;
  }
}

async function setStatus(row: RegistryRow, status: 'active' | 'hidden' | 'blocked'): Promise<void> {
  busyId.value = row.id;
  const url: string = `/api/admin/registry/instances/${row.id}/status`;
  try {
    await $fetch(url, { method: 'POST', body: { status } });
    toast.success(status === 'active' ? 'Instance shown' : status === 'hidden' ? 'Instance hidden' : 'Instance blocked');
    emit('changed');
  } catch {
    toast.error('Failed to update instance');
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <div>
    <p class="cpub-fed-explain">
      The <strong>registry</strong> lists CommonPub instances that announce themselves here. Mirror
      one to pull its content, or request it to mirror you (CommonPub-to-CommonPub). Hide or block
      an entry to curate the public directory.
    </p>
    <p v-if="announcingTo" class="cpub-fed-info-text" style="margin-bottom: 12px;">
      This instance is announcing itself to <strong>{{ announcingTo }}</strong>.
    </p>

    <form class="cpub-fed-form" style="margin-bottom: 12px;" @submit.prevent="onSearch">
      <input
        v-model="searchTerm"
        type="search"
        placeholder="Search by name or domain"
        class="cpub-fed-input"
        aria-label="Search instances"
      />
      <button type="submit" class="cpub-fed-btn">Search</button>
    </form>

    <div class="cpub-fed-activity-list">
      <div v-if="!instances.length" class="cpub-fed-empty">No instances registered yet.</div>
      <div v-for="i in instances" :key="i.id" class="cpub-fed-activity-row">
        <span class="cpub-reg-dot" :class="{ online: i.online }" :title="i.online ? 'online' : 'offline'" aria-hidden="true"></span>
        <span class="cpub-fed-type">{{ i.name || i.domain }}</span>
        <span class="cpub-fed-actor">
          {{ i.domain }} · {{ i.userCount }} users · {{ i.localPostCount }} posts<template v-if="i.softwareName"> · {{ i.softwareName }} {{ i.softwareVersion }}</template>
        </span>
        <span v-if="i.status !== 'active'" class="cpub-fed-status" :class="i.status === 'blocked' ? 'failed' : 'paused'">{{ i.status }}</span>
        <button class="cpub-fed-btn-sm" :disabled="busyId === i.id" @click="mirror(i, 'pull')">Mirror</button>
        <button class="cpub-fed-btn-sm" :disabled="busyId === i.id" @click="mirror(i, 'push')">Request mirror</button>
        <button v-if="i.status === 'active'" class="cpub-fed-btn-sm" :disabled="busyId === i.id" @click="setStatus(i, 'hidden')">Hide</button>
        <button v-else-if="i.status === 'hidden'" class="cpub-fed-btn-sm" :disabled="busyId === i.id" @click="setStatus(i, 'active')">Unhide</button>
        <button class="cpub-fed-btn-sm cpub-fed-btn-danger" :disabled="busyId === i.id" @click="setStatus(i, i.status === 'blocked' ? 'active' : 'blocked')">
          {{ i.status === 'blocked' ? 'Unblock' : 'Block' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-reg-dot {
  display: inline-block; width: 8px; height: 8px; flex: 0 0 auto;
  background: var(--text-faint); border: var(--border-width-default) solid var(--border);
}
.cpub-reg-dot.online { background: var(--accent); border-color: var(--accent); }

/* Shared federation control styles (repeated for this component's scope). */
.cpub-fed-explain { font-size: 0.8125rem; color: var(--text-dim); line-height: 1.6; margin-bottom: 12px; }
.cpub-fed-info-text { font-size: 0.8125rem; color: var(--text-dim); }
.cpub-fed-form { display: flex; gap: 8px; }
.cpub-fed-input { flex: 1; padding: 8px 12px; font-family: var(--font-mono); font-size: 0.8125rem; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); }
.cpub-fed-btn { padding: 8px 16px; font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; background: var(--accent); color: var(--color-text-inverse); border: var(--border-width-default) solid var(--accent); box-shadow: var(--shadow-sm); }
.cpub-fed-btn:hover { box-shadow: none; transform: translate(2px, 2px); }
.cpub-fed-btn-sm { padding: 4px 10px; font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; cursor: pointer; background: transparent; border: var(--border-width-default) solid var(--border); color: var(--text-dim); }
.cpub-fed-btn-sm:hover { border-color: var(--accent); color: var(--accent); }
.cpub-fed-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.cpub-fed-btn-danger { color: var(--red); border-color: var(--red); }
.cpub-fed-btn-danger:hover { border-color: var(--red); color: var(--red); background: var(--surface2); }
.cpub-fed-activity-list { display: flex; flex-direction: column; }
.cpub-fed-activity-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 8px 0; border-bottom: var(--border-width-default) solid var(--border); font-size: 0.8125rem; }
.cpub-fed-type { font-weight: 600; color: var(--text); }
.cpub-fed-actor { color: var(--text-dim); font-size: 0.75rem; flex: 1; min-width: 0; }
.cpub-fed-empty { color: var(--text-faint); padding: 16px 0; font-size: 0.8125rem; }
.cpub-fed-status { font-size: 10px; font-weight: 600; padding: 2px 6px; text-transform: uppercase; font-family: var(--font-mono); border: var(--border-width-default) solid var(--border); }
.cpub-fed-status.paused { color: var(--text-dim); background: var(--surface2); }
.cpub-fed-status.failed { color: var(--red); border-color: var(--red); }
</style>
