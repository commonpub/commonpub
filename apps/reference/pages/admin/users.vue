<script setup lang="ts">
definePageMeta({ layout: 'admin' });
useSeoMeta({ title: 'Users — Admin — CommonPub' });

const search = ref('');
const toast = useToast();

const { data: users, refresh } = await useFetch('/api/admin/users', {
  query: computed(() => ({ search: search.value || undefined })),
});

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

const userList = computed<AdminUser[]>(() => {
  if (!users.value) return [];
  if (Array.isArray(users.value)) return users.value as AdminUser[];
  return (users.value as { items?: AdminUser[] }).items ?? [];
});

const roles = ['member', 'pro', 'verified', 'staff', 'admin'] as const;

async function changeRole(userId: string, role: string): Promise<void> {
  try {
    await $fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role },
    });
    toast.success('Role updated');
    await refresh();
  } catch {
    toast.error('Failed to update role');
  }
}

async function toggleStatus(userId: string, currentStatus: string): Promise<void> {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  try {
    await $fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: { status: newStatus },
    });
    toast.success(`User ${newStatus}`);
    await refresh();
  } catch {
    toast.error('Failed to update status');
  }
}

async function deleteUser(userId: string, username: string): Promise<void> {
  if (!confirm(`Delete user @${username}? This cannot be undone.`)) return;
  try {
    await $fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    toast.success('User deleted');
    await refresh();
  } catch {
    toast.error('Failed to delete user');
  }
}
</script>

<template>
  <div class="admin-users">
    <h1 class="admin-page-title">Users</h1>

    <input v-model="search" type="search" class="admin-search" placeholder="Search users..." aria-label="Search users" />

    <div class="admin-table-wrap" v-if="userList.length">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in userList" :key="u.id">
            <td>
              <NuxtLink :to="`/u/${u.username}`" class="admin-link">@{{ u.username }}</NuxtLink>
            </td>
            <td class="admin-email">{{ u.email }}</td>
            <td>
              <select
                class="admin-role-select"
                :value="u.role"
                @change="changeRole(u.id, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
              </select>
            </td>
            <td>
              <button
                class="admin-status-btn"
                :class="u.status === 'active' ? 'status-active' : 'status-suspended'"
                @click="toggleStatus(u.id, u.status)"
              >
                {{ u.status }}
              </button>
            </td>
            <td class="admin-date">{{ new Date(u.createdAt).toLocaleDateString() }}</td>
            <td>
              <button class="admin-delete-btn" title="Delete user" @click="deleteUser(u.id, u.username)">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="admin-empty" v-else>No users found.</p>
  </div>
</template>

<style scoped>
.admin-page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: 16px; }
.admin-search { width: 100%; max-width: 400px; padding: 6px 10px; border: 2px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; margin-bottom: 16px; }
.admin-search:focus { outline: none; border-color: var(--accent); }
.admin-table-wrap { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table th { text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border); font-weight: 600; color: var(--text-dim); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-mono); }
.admin-table td { padding: 8px 12px; border-bottom: 1px solid var(--border2); }
.admin-link { color: var(--accent); text-decoration: none; font-weight: 500; }
.admin-link:hover { text-decoration: underline; }
.admin-email { font-size: 12px; color: var(--text-dim); }
.admin-date { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.admin-role-select { padding: 3px 6px; border: 1px solid var(--border2); background: var(--surface); color: var(--text-dim); font-size: 11px; font-family: var(--font-mono); text-transform: capitalize; cursor: pointer; }
.admin-role-select:focus { border-color: var(--accent); outline: none; }
.admin-status-btn { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; cursor: pointer; border: 1px solid; background: none; }
.status-active { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.status-suspended { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }
.admin-status-btn:hover { opacity: 0.8; }
.admin-delete-btn { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.admin-delete-btn:hover { color: var(--red); }
.admin-empty { color: var(--text-faint); text-align: center; padding: 32px 0; }
</style>
