<script setup lang="ts">
const route = useRoute();
const slug = computed(() => route.params.slug as string);
const toast = useToast();

const { data: hub } = useLazyFetch(() => `/api/hubs/${slug.value}`);
const { data: membersData, refresh } = useLazyFetch<{ items: any[]; total: number }>(() => `/api/hubs/${slug.value}/members`);
const members = computed(() => membersData.value?.items ?? []);

const { user } = useAuth();
const currentUserRole = computed(() => hub.value?.currentUserRole ?? null);
const canManage = computed(() => currentUserRole.value === 'owner' || currentUserRole.value === 'admin');

interface BanItem {
  id: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  bannedBy: { username: string; displayName: string | null };
}

// The bans endpoint is manager-only (403 otherwise), so fetch it lazily once
// the viewer is confirmed to manage this hub.
const { data: bansData, refresh: refreshBans } = useLazyFetch<BanItem[]>(() => `/api/hubs/${slug.value}/bans`, { immediate: false });
const bans = computed(() => bansData.value ?? []);
watch(canManage, (v) => { if (v) refreshBans(); }, { immediate: true });

// Pending join requests (approval-gated hubs). Manager-only, fetched lazily.
const { data: requestsData, refresh: refreshRequests } = useLazyFetch<{ items: any[]; total: number }>(() => `/api/hubs/${slug.value}/requests`, { immediate: false });
const requests = computed(() => requestsData.value?.items ?? []);
watch(canManage, (v) => { if (v) refreshRequests(); }, { immediate: true });

async function approveRequest(userId: string): Promise<void> {
  try {
    await $fetch(`/api/hubs/${slug.value}/requests/${userId}/approve`, { method: 'POST' });
    toast.success('Request approved');
    await Promise.all([refreshRequests(), refresh()]);
  } catch {
    toast.error('Failed to approve request');
  }
}

async function denyRequest(userId: string): Promise<void> {
  try {
    await $fetch(`/api/hubs/${slug.value}/requests/${userId}/deny`, { method: 'POST' });
    toast.success('Request declined');
    await refreshRequests();
  } catch {
    toast.error('Failed to decline request');
  }
}

useSeoMeta({ title: () => `Members, ${hub.value?.name ?? 'Hub'}, ${useSiteName()}` });

const roles = ['member', 'moderator', 'admin'] as const;

const roleColors: Record<string, string> = {
  owner: 'var(--yellow)',
  admin: 'var(--red)',
  moderator: 'var(--accent)',
  member: 'var(--text-faint)',
};

async function changeRole(userId: string, role: string): Promise<void> {
  try {
    await $fetch(`/api/hubs/${slug.value}/members/${userId}`, {
      method: 'PUT',
      body: { role },
    });
    toast.success('Role updated');
    await refresh();
  } catch {
    toast.error('Failed to update role');
  }
}

async function kickMember(userId: string, username: string): Promise<void> {
  if (!confirm(`Remove @${username} from this hub?`)) return;
  try {
    await $fetch(`/api/hubs/${slug.value}/members/${userId}`, { method: 'DELETE' });
    toast.success('Member removed');
    await refresh();
  } catch {
    toast.error('Failed to remove member');
  }
}

async function banMember(userId: string, username: string): Promise<void> {
  // One native dialog doubles as the confirm: OK (even empty) bans with that
  // optional reason; Cancel aborts.
  const reason = prompt(`Ban @${username} from this hub? They will be removed and blocked from rejoining. Enter an optional reason, or Cancel to abort.`);
  if (reason === null) return;
  try {
    await $fetch(`/api/hubs/${slug.value}/bans`, {
      method: 'POST',
      body: { userId, reason: reason.trim() || undefined },
    });
    toast.success('Member banned');
    await Promise.all([refresh(), refreshBans()]);
  } catch {
    toast.error('Failed to ban member');
  }
}

async function unbanMember(userId: string, username: string): Promise<void> {
  if (!confirm(`Lift the ban on @${username}? They will be able to rejoin.`)) return;
  try {
    await $fetch(`/api/hubs/${slug.value}/bans/${userId}`, { method: 'DELETE' });
    toast.success('Ban lifted');
    await refreshBans();
  } catch {
    toast.error('Failed to lift ban');
  }
}
</script>

<template>
  <div class="members-page">
    <div class="members-header">
      <NuxtLink :to="`/hubs/${slug}`" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> {{ hub?.name ?? 'Hub' }}</NuxtLink>
      <h1 class="members-title">Members</h1>
      <p class="members-count" v-if="membersData?.total">{{ membersData.total }} members</p>
    </div>

    <!-- Pending join requests (managers only) -->
    <section v-if="canManage && requests.length" class="requests-section">
      <h2 class="requests-title">Join requests</h2>
      <div class="members-list">
        <div class="member-card" v-for="r in requests" :key="r.userId">
          <NuxtLink :to="`/u/${r.user.username}`" class="member-avatar">
            <img v-if="r.user.avatarUrl" :src="r.user.avatarUrl" :alt="r.user.displayName || r.user.username" class="member-avatar-img" />
            <span v-else>{{ (r.user.displayName || r.user.username).charAt(0).toUpperCase() }}</span>
          </NuxtLink>
          <div class="member-info">
            <NuxtLink :to="`/u/${r.user.username}`" class="member-name">{{ r.user.displayName || r.user.username }}</NuxtLink>
            <span class="member-handle">@{{ r.user.username }}</span>
          </div>
          <time class="member-joined">{{ new Date(r.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</time>
          <div class="member-actions">
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" @click="approveRequest(r.userId)">Approve</button>
            <button class="cpub-btn cpub-btn-sm member-deny-btn" @click="denyRequest(r.userId)">Deny</button>
          </div>
        </div>
      </div>
    </section>

    <div class="members-list" v-if="members?.length">
      <div class="member-card" v-for="m in members" :key="m.userId">
        <NuxtLink :to="`/u/${m.user.username}`" class="member-avatar">
          <img v-if="m.user.avatarUrl" :src="m.user.avatarUrl" :alt="m.user.displayName || m.user.username" class="member-avatar-img" />
          <span v-else>{{ (m.user.displayName || m.user.username).charAt(0).toUpperCase() }}</span>
        </NuxtLink>
        <div class="member-info">
          <NuxtLink :to="`/u/${m.user.username}`" class="member-name">
            {{ m.user.displayName || m.user.username }}
          </NuxtLink>
          <span class="member-handle">@{{ m.user.username }}</span>
        </div>
        <span class="member-role-badge" :style="{ color: roleColors[m.role] || 'var(--text-faint)', borderColor: roleColors[m.role] || 'var(--border2)' }">
          {{ m.role }}
        </span>
        <time class="member-joined">{{ new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }}</time>

        <!-- Admin actions -->
        <div v-if="canManage && m.role !== 'owner' && m.userId !== user?.id" class="member-actions">
          <select
            class="member-role-select"
            :value="m.role"
            @change="changeRole(m.userId, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
          </select>
          <button class="member-kick-btn" title="Remove member" @click="kickMember(m.userId, m.user.username)">
            <i class="fa-solid fa-user-xmark"></i>
          </button>
          <button class="member-ban-btn" title="Ban member" aria-label="Ban member" @click="banMember(m.userId, m.user.username)">
            <i class="fa-solid fa-ban"></i>
          </button>
        </div>
      </div>
    </div>
    <div v-else class="members-empty">
      <p>No members yet.</p>
    </div>

    <!-- Banned users (managers only) -->
    <section v-if="canManage && bans.length" class="bans-section">
      <h2 class="bans-title">Banned</h2>
      <div class="members-list">
        <div class="member-card" v-for="b in bans" :key="b.id">
          <NuxtLink :to="`/u/${b.user.username}`" class="member-avatar">
            <img v-if="b.user.avatarUrl" :src="b.user.avatarUrl" :alt="b.user.displayName || b.user.username" class="member-avatar-img" />
            <span v-else>{{ (b.user.displayName || b.user.username).charAt(0).toUpperCase() }}</span>
          </NuxtLink>
          <div class="member-info">
            <NuxtLink :to="`/u/${b.user.username}`" class="member-name">{{ b.user.displayName || b.user.username }}</NuxtLink>
            <span class="member-handle">@{{ b.user.username }}</span>
            <span v-if="b.reason" class="ban-reason">{{ b.reason }}</span>
          </div>
          <span class="ban-meta">{{ b.expiresAt ? 'Temporary' : 'Permanent' }}</span>
          <button class="member-unban-btn" title="Lift ban" @click="unbanMember(b.user.id, b.user.username)">
            <i class="fa-solid fa-rotate-left"></i> Unban
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.members-page { max-width: 720px; margin: 0 auto; padding: 32px; }
.members-header { margin-bottom: 20px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.cpub-back-link:hover { color: var(--accent); }
.members-title { font-size: 22px; font-weight: 700; margin-bottom: 2px; }
.members-count { font-size: 12px; font-family: var(--font-mono); color: var(--text-faint); }

.members-list { border: var(--border-width-default) solid var(--border); background: var(--surface); }
.member-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: var(--border-width-default) solid var(--border2); }
.member-card:last-child { border-bottom: none; }

.member-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--surface3); border: var(--border-width-default) solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); text-decoration: none; flex-shrink: 0; overflow: hidden; }
.member-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }

.member-info { flex: 1; min-width: 0; }
.member-name { font-size: 13px; font-weight: 600; color: var(--text); text-decoration: none; display: block; }
.member-name:hover { color: var(--accent); }
.member-handle { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }

.member-role-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border: var(--border-width-default) solid; flex-shrink: 0; }

.member-joined { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); flex-shrink: 0; }

.member-actions { display: flex; gap: 4px; flex-shrink: 0; }
.member-role-select { padding: 3px 6px; border: var(--border-width-default) solid var(--border2); background: var(--surface); color: var(--text-dim); font-size: 10px; font-family: var(--font-mono); text-transform: capitalize; cursor: pointer; }
.member-role-select:focus { border-color: var(--accent); outline: none; }
.member-kick-btn { background: none; border: var(--border-width-default) solid var(--border2); color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 3px 6px; }
.member-kick-btn:hover { color: var(--red); border-color: var(--red); }
.member-ban-btn { background: none; border: var(--border-width-default) solid var(--border2); color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 3px 6px; }
.member-ban-btn:hover { color: var(--red); border-color: var(--red); }

.members-empty { text-align: center; padding: 48px 0; color: var(--text-faint); }

.requests-section { margin-bottom: 28px; }
.requests-title { font-size: 13px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 10px; }
.member-deny-btn:hover { color: var(--red); border-color: var(--red); }

.bans-section { margin-top: 28px; }
.bans-title { font-size: 13px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 10px; }
.ban-reason { display: block; font-size: 11px; color: var(--text-faint); margin-top: 2px; }
.ban-meta { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); flex-shrink: 0; }
.member-unban-btn { background: none; border: var(--border-width-default) solid var(--border2); color: var(--text-dim); cursor: pointer; font-size: 10px; font-family: var(--font-mono); padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.member-unban-btn:hover { color: var(--accent); border-color: var(--accent); }

@media (max-width: 768px) {
  .members-page { padding: 16px; }
  .member-card { flex-wrap: wrap; gap: 8px; padding: 10px 12px; }
  .member-joined { display: none; }
  .member-actions { width: 100%; justify-content: flex-end; }
}
</style>
