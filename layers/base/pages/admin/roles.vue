<script setup lang="ts">
import type { RoleWithPermissions } from '@commonpub/server';

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: () => `Roles, ${useSiteName()}` });

const toast = useToast();
const { extract: extractError } = useApiError();
const { rbac: rbacEnabled, features } = useFeatures();

const { data: roles, refresh } = await useFetch<RoleWithPermissions[]>('/api/admin/roles');
const { data: catalog } = await useFetch<string[]>('/api/admin/permissions');

// --- Master RBAC switch (configure-then-activate) ---
// Roles can be staged while RBAC is off; flipping the flag activates them
// instantly (and is a reversible kill-switch). Writes the DB feature override
// via /api/admin/features (needs `settings.manage`).
const togglingRbac = ref(false);

async function setRbac(enabled: boolean): Promise<void> {
  if (
    enabled &&
    !confirm(
      'Enable RBAC now? Role permissions take effect immediately: any user with the staff role becomes a moderator and custom roles activate. Admins keep full access. You can disable it again at any time.',
    )
  ) {
    return;
  }
  togglingRbac.value = true;
  try {
    await ($fetch as Function)('/api/admin/features', { method: 'PUT', body: { overrides: { rbac: enabled } } });
    // Update the shared reactive flag state so the banner reflects it at once.
    features.value = { ...features.value, rbac: enabled };
    toast.success(enabled ? 'RBAC enabled, role permissions are now live' : 'RBAC disabled, back to admin-only');
  } catch (err) {
    toast.error(extractError(err));
  } finally {
    togglingRbac.value = false;
  }
}

// Group the flat permission catalog by first segment for a tidy editor.
const grouped = computed<Record<string, string[]>>(() => {
  const out: Record<string, string[]> = {};
  for (const key of catalog.value ?? []) {
    const group = key === '*' ? 'global' : key.includes('.') ? key.slice(0, key.indexOf('.')) : key;
    (out[group] ??= []).push(key);
  }
  return out;
});

// --- Edit existing role permissions ---
const editingId = ref<string | null>(null);
const editPerms = ref<Set<string>>(new Set());
const editName = ref('');
const savingEdit = ref(false);

function startEdit(role: RoleWithPermissions): void {
  editingId.value = role.id;
  editName.value = role.name;
  editPerms.value = new Set(role.permissions);
}
function cancelEdit(): void {
  editingId.value = null;
  editPerms.value = new Set();
}
function toggleEditPerm(key: string): void {
  if (editPerms.value.has(key)) editPerms.value.delete(key);
  else editPerms.value.add(key);
  editPerms.value = new Set(editPerms.value);
}
async function saveEdit(role: RoleWithPermissions): Promise<void> {
  savingEdit.value = true;
  try {
    await ($fetch as Function)(`/api/admin/roles/${role.id}`, {
      method: 'PUT',
      body: { name: editName.value, permissions: [...editPerms.value] },
    });
    toast.success('Role updated');
    cancelEdit();
    await refresh();
  } catch (err) {
    toast.error(extractError(err));
  } finally {
    savingEdit.value = false;
  }
}

async function removeRole(role: RoleWithPermissions): Promise<void> {
  if (!confirm(`Delete the "${role.name}" role? Users lose its permissions.`)) return;
  try {
    await ($fetch as Function)(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
    toast.success('Role deleted');
    await refresh();
  } catch (err) {
    toast.error(extractError(err));
  }
}

// --- Create a new custom role ---
const showCreate = ref(false);
const newKey = ref('');
const newName = ref('');
const newDesc = ref('');
const newPerms = ref<Set<string>>(new Set());
const creating = ref(false);

function toggleNewPerm(key: string): void {
  if (newPerms.value.has(key)) newPerms.value.delete(key);
  else newPerms.value.add(key);
  newPerms.value = new Set(newPerms.value);
}
async function createRole(): Promise<void> {
  if (!newKey.value || !newName.value) { toast.error('Key and name are required'); return; }
  creating.value = true;
  try {
    await ($fetch as Function)('/api/admin/roles', {
      method: 'POST',
      body: { key: newKey.value, name: newName.value, description: newDesc.value || null, permissions: [...newPerms.value] },
    });
    toast.success('Role created');
    showCreate.value = false;
    newKey.value = ''; newName.value = ''; newDesc.value = ''; newPerms.value = new Set();
    await refresh();
  } catch (err) {
    toast.error(extractError(err));
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <div class="cpub-roles">
    <div class="cpub-roles-head">
      <h1 class="cpub-admin-title">Roles &amp; Permissions</h1>
      <button class="cpub-btn cpub-btn-sm" @click="showCreate = !showCreate">
        <i class="fa-solid fa-plus"></i> New role
      </button>
    </div>

    <!-- Master RBAC switch — off: stage roles then activate; on: live + kill-switch. -->
    <div v-if="!rbacEnabled" class="cpub-rbac-banner cpub-rbac-banner--off">
      <div class="cpub-rbac-banner-text">
        <strong>RBAC is off.</strong> These role permissions have no effect yet, the instance runs
        admin-only. Stage your roles and assignments here, then turn RBAC on to activate them all at once.
      </div>
      <button class="cpub-btn cpub-btn-sm" :disabled="togglingRbac" @click="setRbac(true)">
        <i class="fa-solid fa-toggle-on"></i> {{ togglingRbac ? 'Enabling...' : 'Enable RBAC' }}
      </button>
    </div>
    <div v-else class="cpub-rbac-banner cpub-rbac-banner--on">
      <div class="cpub-rbac-banner-text">
        <strong>RBAC is enabled.</strong> Role permissions are live, staff is a moderator and custom
        roles are active. Admins always keep full access.
      </div>
      <button class="cpub-btn cpub-btn-sm cpub-btn-ghost" :disabled="togglingRbac" @click="setRbac(false)">
        <i class="fa-solid fa-toggle-off"></i> {{ togglingRbac ? 'Disabling...' : 'Disable' }}
      </button>
    </div>

    <!-- Create form -->
    <section v-if="showCreate" class="cpub-role-card cpub-role-create">
      <h2 class="cpub-role-card-title">New custom role</h2>
      <div class="cpub-role-fields">
        <label class="cpub-field">
          <span class="cpub-field-label">Key</span>
          <input v-model="newKey" class="cpub-input" placeholder="e.g. moderator" />
        </label>
        <label class="cpub-field">
          <span class="cpub-field-label">Name</span>
          <input v-model="newName" class="cpub-input" placeholder="e.g. Moderator" />
        </label>
      </div>
      <label class="cpub-field">
        <span class="cpub-field-label">Description</span>
        <input v-model="newDesc" class="cpub-input" placeholder="What this role is for" />
      </label>
      <div class="cpub-perm-groups">
        <fieldset v-for="(keys, group) in grouped" :key="group" class="cpub-perm-group">
          <legend class="cpub-perm-legend">{{ group }}</legend>
          <label v-for="k in keys" :key="k" class="cpub-perm-check">
            <input type="checkbox" :checked="newPerms.has(k)" @change="toggleNewPerm(k)" />
            <span>{{ k }}</span>
          </label>
        </fieldset>
      </div>
      <div class="cpub-role-actions">
        <button class="cpub-btn cpub-btn-sm" :disabled="creating" @click="createRole">
          {{ creating ? 'Creating...' : 'Create role' }}
        </button>
        <button class="cpub-btn cpub-btn-sm cpub-btn-ghost" @click="showCreate = false">Cancel</button>
      </div>
    </section>

    <!-- Role list -->
    <div class="cpub-role-list">
      <div v-for="role in roles ?? []" :key="role.id" class="cpub-role-card">
        <div class="cpub-role-row">
          <div class="cpub-role-meta">
            <span class="cpub-role-name">{{ role.name }}</span>
            <span class="cpub-role-key">{{ role.key }}</span>
            <span v-if="role.isSystem" class="cpub-role-badge">system</span>
          </div>
          <div class="cpub-role-stats">
            <span>{{ role.memberCount }} {{ role.memberCount === 1 ? 'user' : 'users' }}</span>
            <button class="cpub-btn cpub-btn-xs" @click="editingId === role.id ? cancelEdit() : startEdit(role)">
              {{ editingId === role.id ? 'Close' : 'Edit' }}
            </button>
            <button v-if="!role.isSystem" class="cpub-btn cpub-btn-xs cpub-btn-danger" @click="removeRole(role)">
              Delete
            </button>
          </div>
        </div>
        <p v-if="role.description" class="cpub-role-desc">{{ role.description }}</p>
        <div v-if="editingId !== role.id" class="cpub-role-perms">
          <span v-if="role.permissions.includes('*')" class="cpub-perm-tag cpub-perm-tag-all">* full access</span>
          <span v-for="p in role.permissions.filter((x) => x !== '*')" :key="p" class="cpub-perm-tag">{{ p }}</span>
          <span v-if="!role.permissions.length" class="cpub-role-none">No permissions (entitlement tier only)</span>
        </div>

        <!-- Inline editor -->
        <div v-else class="cpub-role-edit">
          <label class="cpub-field">
            <span class="cpub-field-label">Name</span>
            <input v-model="editName" class="cpub-input" />
          </label>
          <div class="cpub-perm-groups">
            <fieldset v-for="(keys, group) in grouped" :key="group" class="cpub-perm-group">
              <legend class="cpub-perm-legend">{{ group }}</legend>
              <label v-for="k in keys" :key="k" class="cpub-perm-check">
                <input type="checkbox" :checked="editPerms.has(k)" @change="toggleEditPerm(k)" />
                <span>{{ k }}</span>
              </label>
            </fieldset>
          </div>
          <div class="cpub-role-actions">
            <button class="cpub-btn cpub-btn-sm" :disabled="savingEdit" @click="saveEdit(role)">
              {{ savingEdit ? 'Saving...' : 'Save' }}
            </button>
            <button class="cpub-btn cpub-btn-sm cpub-btn-ghost" @click="cancelEdit">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cpub-admin-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); }
.cpub-roles-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); gap: var(--space-3); }
.cpub-rbac-banner { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-3) var(--space-4); border: var(--border-width-default) solid var(--border); margin-bottom: var(--space-5); }
.cpub-rbac-banner-text { font-size: var(--text-sm); color: var(--text-dim); line-height: 1.6; flex: 1; min-width: 0; }
.cpub-rbac-banner-text strong { color: var(--text); }
.cpub-rbac-banner--off { background: var(--surface2); }
.cpub-rbac-banner--on { background: var(--green-bg, var(--surface2)); border-color: var(--green-border, var(--accent)); }
.cpub-rbac-banner .cpub-btn { flex-shrink: 0; }
.cpub-role-list { display: flex; flex-direction: column; gap: var(--space-3); }
.cpub-role-card { padding: var(--space-4); background: var(--surface); border: var(--border-width-default) solid var(--border); box-shadow: var(--shadow-md); }
.cpub-role-create { margin-bottom: var(--space-5); }
.cpub-role-card-title { font-size: var(--text-md); font-weight: var(--font-weight-bold); margin-bottom: var(--space-3); }
.cpub-role-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.cpub-role-meta { display: flex; align-items: baseline; gap: var(--space-2); flex-wrap: wrap; }
.cpub-role-name { font-weight: var(--font-weight-bold); }
.cpub-role-key { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-faint); }
.cpub-role-badge { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; letter-spacing: var(--tracking-wide); padding: 1px 5px; border: var(--border-width-default) solid var(--border); color: var(--text-dim); }
.cpub-role-stats { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xs); color: var(--text-dim); font-family: var(--font-mono); }
.cpub-role-desc { font-size: var(--text-sm); color: var(--text-dim); margin: var(--space-2) 0 0; }
.cpub-role-perms { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: var(--space-3); }
.cpub-perm-tag { font-family: var(--font-mono); font-size: 10px; padding: 2px 6px; background: var(--surface2); border: var(--border-width-default) solid var(--border); color: var(--text-dim); }
.cpub-perm-tag-all { color: var(--accent); border-color: var(--accent); }
.cpub-role-none { font-size: var(--text-xs); color: var(--text-faint); font-style: italic; }
.cpub-role-edit, .cpub-role-fields { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-3); }
.cpub-role-fields { flex-direction: row; }
.cpub-field { display: flex; flex-direction: column; gap: var(--space-1); flex: 1; }
.cpub-field-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--text-dim); }
.cpub-input { font-size: var(--text-sm); padding: var(--space-2) var(--space-3); border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; }
.cpub-input:focus { border-color: var(--accent); }
.cpub-perm-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-3); margin-top: var(--space-2); }
.cpub-perm-group { border: var(--border-width-default) solid var(--border); padding: var(--space-2) var(--space-3); }
.cpub-perm-legend { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: var(--tracking-wide); color: var(--text-dim); padding: 0 var(--space-1); }
.cpub-perm-check { display: flex; align-items: center; gap: var(--space-2); font-family: var(--font-mono); font-size: 11px; padding: 2px 0; cursor: pointer; }
.cpub-role-actions { display: flex; gap: var(--space-2); margin-top: var(--space-3); }
.cpub-btn-xs { font-size: 10px; padding: 3px 8px; }
.cpub-btn-ghost { background: none; }
</style>
