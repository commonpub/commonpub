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

useSeoMeta({ title: () => `Members — ${hub.value?.name ?? 'Hub'} — CommonPub` });

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
</script>

<template>
  <div class="members-page">
    <div class="members-header">
      <NuxtLink :to="`/hubs/${slug}`" class="cpub-back-link"><i class="fa-solid fa-arrow-left"></i> {{ hub?.name ?? 'Hub' }}</NuxtLink>
      <h1 class="members-title">Members</h1>
      <p class="members-count" v-if="membersData?.total">{{ membersData.total }} members</p>
    </div>

    <div class="members-list" v-if="members?.length">
      <div class="member-card" v-for="m in members" :key="m.userId">
        <NuxtLink :to="`/u/${m.user.username}`" class="member-avatar">
          {{ (m.user.displayName || m.user.username).charAt(0).toUpperCase() }}
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
        </div>
      </div>
    </div>
    <div v-else class="members-empty">
      <p>No members yet.</p>
    </div>
  </div>
</template>

<style scoped>
.members-page { max-width: 720px; margin: 0 auto; padding: 32px; }
.members-header { margin-bottom: 20px; }
.cpub-back-link { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.cpub-back-link:hover { color: var(--accent); }
.members-title { font-size: 22px; font-weight: 700; margin-bottom: 2px; }
.members-count { font-size: 12px; font-family: var(--font-mono); color: var(--text-faint); }

.members-list { border: 2px solid var(--border); background: var(--surface); }
.member-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border2); }
.member-card:last-child { border-bottom: none; }

.member-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--surface3); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--accent); font-family: var(--font-mono); text-decoration: none; flex-shrink: 0; }

.member-info { flex: 1; min-width: 0; }
.member-name { font-size: 13px; font-weight: 600; color: var(--text); text-decoration: none; display: block; }
.member-name:hover { color: var(--accent); }
.member-handle { font-size: 11px; color: var(--text-faint); font-family: var(--font-mono); }

.member-role-badge { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border: 1px solid; flex-shrink: 0; }

.member-joined { font-size: 10px; color: var(--text-faint); font-family: var(--font-mono); flex-shrink: 0; }

.member-actions { display: flex; gap: 4px; flex-shrink: 0; }
.member-role-select { padding: 3px 6px; border: 1px solid var(--border2); background: var(--surface); color: var(--text-dim); font-size: 10px; font-family: var(--font-mono); text-transform: capitalize; cursor: pointer; }
.member-role-select:focus { border-color: var(--accent); outline: none; }
.member-kick-btn { background: none; border: 1px solid var(--border2); color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 3px 6px; }
.member-kick-btn:hover { color: var(--red); border-color: var(--red); }

.members-empty { text-align: center; padding: 48px 0; color: var(--text-faint); }
</style>
