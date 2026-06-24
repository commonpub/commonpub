<script setup lang="ts">
import type { RoleWithPermissions } from '@commonpub/server';

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Users, Admin, ${useSiteName()}` });

const search = ref('');
const toast = useToast();

const { data: users, refresh } = await useFetch('/api/admin/users', {
  query: computed(() => ({ search: search.value || undefined })),
});

// Custom (non-system) roles — for per-user assignment. Requires `roles.manage`;
// useFetch won't crash the page if the viewer lacks it (data stays null).
const { data: allRoles } = await useFetch<RoleWithPermissions[]>('/api/admin/roles');
const customRoles = computed<RoleWithPermissions[]>(() => (allRoles.value ?? []).filter((r) => !r.isSystem));

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

// --- Custom-role assignment (expand a row to edit a user's custom roles) ---
const expandedUserId = ref<string | null>(null);
const editingRoleIds = ref<Set<string>>(new Set());
const savingRoles = ref(false);

async function toggleRolesEditor(userId: string): Promise<void> {
  if (expandedUserId.value === userId) {
    expandedUserId.value = null;
    return;
  }
  expandedUserId.value = userId;
  editingRoleIds.value = new Set();
  try {
    const { roleIds } = await $fetch<{ roleIds: string[] }>(`/api/admin/users/${userId}/roles`);
    editingRoleIds.value = new Set(roleIds);
  } catch {
    toast.error('Could not load this user’s roles');
  }
}

function toggleRoleId(roleId: string): void {
  const next = new Set(editingRoleIds.value);
  if (next.has(roleId)) next.delete(roleId);
  else next.add(roleId);
  editingRoleIds.value = next;
}

async function saveRoles(userId: string): Promise<void> {
  savingRoles.value = true;
  try {
    // Only custom role ids are sent; the system/primary role is the dropdown above.
    const customIds = new Set(customRoles.value.map((r) => r.id));
    const roleIds = [...editingRoleIds.value].filter((id) => customIds.has(id));
    await $fetch(`/api/admin/users/${userId}/roles`, { method: 'PUT', body: { roleIds } });
    toast.success('Custom roles updated');
    expandedUserId.value = null;
  } catch {
    toast.error('Failed to update custom roles');
  } finally {
    savingRoles.value = false;
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
            <th v-if="customRoles.length">Custom roles</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="u in userList" :key="u.id">
          <tr>
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
            <td v-if="customRoles.length">
              <button class="admin-roles-btn" :aria-expanded="expandedUserId === u.id" @click="toggleRolesEditor(u.id)">
                <i class="fa-solid fa-user-shield"></i> {{ expandedUserId === u.id ? 'Close' : 'Assign' }}
              </button>
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
          <tr v-if="expandedUserId === u.id && customRoles.length" class="admin-roles-row">
            <td :colspan="7">
              <div class="admin-roles-editor">
                <span class="admin-roles-label">Custom roles for @{{ u.username }}:</span>
                <label v-for="r in customRoles" :key="r.id" class="admin-roles-check">
                  <input type="checkbox" :checked="editingRoleIds.has(r.id)" @change="toggleRoleId(r.id)" />
                  <span>{{ r.name }}</span>
                </label>
                <button class="admin-roles-save" :disabled="savingRoles" @click="saveRoles(u.id)">
                  {{ savingRoles ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>
    <p class="admin-empty" v-else>No users found.</p>
  </div>
</template>

<style scoped>
.admin-page-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); margin-bottom: 16px; }
.admin-search { width: 100%; max-width: 400px; padding: 6px 10px; border: var(--border-width-default) solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; margin-bottom: 16px; }
.admin-search:focus { outline: none; border-color: var(--accent); }
.admin-table-wrap { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table th { text-align: left; padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border); font-weight: 600; color: var(--text-dim); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; font-family: var(--font-mono); }
.admin-table td { padding: 8px 12px; border-bottom: var(--border-width-default) solid var(--border2); }
.admin-link { color: var(--accent); text-decoration: none; font-weight: 500; }
.admin-link:hover { text-decoration: underline; }
.admin-email { font-size: 12px; color: var(--text-dim); }
.admin-date { font-size: 11px; font-family: var(--font-mono); color: var(--text-faint); }
.admin-role-select { padding: 3px 6px; border: var(--border-width-default) solid var(--border2); background: var(--surface); color: var(--text-dim); font-size: 11px; font-family: var(--font-mono); text-transform: capitalize; cursor: pointer; }
.admin-role-select:focus { border-color: var(--accent); outline: none; }
.admin-status-btn { font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; padding: 2px 8px; cursor: pointer; border: var(--border-width-default) solid; background: none; }
.status-active { color: var(--green-text); border-color: var(--green-border); background: var(--green-bg); }
.status-suspended { color: var(--red-text); border-color: var(--red-border); background: var(--red-bg); }
.admin-status-btn:hover { opacity: 0.8; }
.admin-delete-btn { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.admin-delete-btn:hover { color: var(--red-text); }
.admin-roles-btn { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 8px; border: var(--border-width-default) solid var(--border2); background: var(--surface); color: var(--text-dim); cursor: pointer; }
.admin-roles-btn:hover { border-color: var(--accent); color: var(--text); }
.admin-roles-row td { background: var(--surface2); }
.admin-roles-editor { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 4px 0; }
.admin-roles-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
.admin-roles-check { display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; }
.admin-roles-save { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; padding: 3px 10px; border: var(--border-width-default) solid var(--accent); background: var(--accent); color: var(--color-on-accent); cursor: pointer; margin-left: auto; }
.admin-roles-save:disabled { opacity: 0.6; cursor: default; }
.admin-empty { color: var(--text-faint); text-align: center; padding: 32px 0; }
</style>
