<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });

useSeoMeta({ title: `Settings — Admin — ${useSiteName()}` });

const { data: settings, pending, refresh } = await useFetch<Record<string, string>>('/api/admin/settings');

const saving = ref(false);
const editKey = ref('');
const editValue = ref('');
const newKey = ref('');
const newValue = ref('');

const knownSettings = [
  { key: 'instance.name', label: 'Instance Name', desc: 'Public name of this CommonPub instance' },
  { key: 'instance.description', label: 'Instance Description', desc: 'Short description shown in metadata' },
  { key: 'instance.registrationOpen', label: 'Open Registration', desc: 'Allow new user signups (true/false)' },
  { key: 'instance.maxUploadSize', label: 'Max Upload Size (MB)', desc: 'Maximum file upload size in megabytes' },
  { key: 'instance.contactEmail', label: 'Contact Email', desc: 'Admin contact email for the instance' },
];

function startEdit(key: string, value: string): void {
  editKey.value = key;
  editValue.value = value;
}

function cancelEdit(): void {
  editKey.value = '';
  editValue.value = '';
}

async function saveSetting(key: string, value: string): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/admin/settings', {
      method: 'PUT',
      body: { key, value },
    });
    editKey.value = '';
    editValue.value = '';
    await refresh();
  } catch {
    // Error handling via toast if available
  } finally {
    saving.value = false;
  }
}

async function addSetting(): Promise<void> {
  if (!newKey.value.trim()) return;
  await saveSetting(newKey.value.trim(), newValue.value);
  newKey.value = '';
  newValue.value = '';
}
</script>

<template>
  <div class="admin-settings">
    <h1 class="admin-page-title">Instance Settings</h1>

    <div class="settings-list" v-if="settings">
      <div v-for="item in knownSettings" :key="item.key" class="settings-row">
        <div class="settings-label">
          <span class="settings-key">{{ item.label }}</span>
          <span class="settings-desc">{{ item.desc }}</span>
        </div>
        <div class="settings-value-col">
          <template v-if="editKey === item.key">
            <input v-model="editValue" class="settings-input" @keyup.enter="saveSetting(item.key, editValue)" @keyup.escape="cancelEdit" />
            <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="saving" @click="saveSetting(item.key, editValue)">Save</button>
            <button class="cpub-btn cpub-btn-sm" @click="cancelEdit">Cancel</button>
          </template>
          <template v-else>
            <span class="settings-value">{{ (settings as Record<string, string>)[item.key] ?? '—' }}</span>
            <button class="cpub-btn cpub-btn-sm" @click="startEdit(item.key, (settings as Record<string, string>)[item.key] ?? '')">Edit</button>
          </template>
        </div>
      </div>
    </div>

    <div class="settings-custom" v-if="settings">
      <h2 class="settings-section-title">Custom Settings</h2>
      <div v-for="(value, key) in (settings as Record<string, string>)" :key="key" class="settings-row">
        <template v-if="!knownSettings.some(k => k.key === key)">
          <div class="settings-label">
            <span class="settings-key-mono">{{ key }}</span>
          </div>
          <div class="settings-value-col">
            <template v-if="editKey === key">
              <input v-model="editValue" class="settings-input" @keyup.enter="saveSetting(key as string, editValue)" @keyup.escape="cancelEdit" />
              <button class="cpub-btn cpub-btn-sm cpub-btn-primary" :disabled="saving" @click="saveSetting(key as string, editValue)">Save</button>
              <button class="cpub-btn cpub-btn-sm" @click="cancelEdit">Cancel</button>
            </template>
            <template v-else>
              <span class="settings-value">{{ value }}</span>
              <button class="cpub-btn cpub-btn-sm" @click="startEdit(key as string, value)">Edit</button>
            </template>
          </div>
        </template>
      </div>

      <div class="settings-add">
        <input v-model="newKey" class="settings-input" placeholder="Setting key" />
        <input v-model="newValue" class="settings-input" placeholder="Value" />
        <button class="cpub-btn cpub-btn-sm" :disabled="!newKey.trim()" @click="addSetting">Add</button>
      </div>
    </div>

    <div v-if="pending" class="admin-loading">
      <i class="fa-solid fa-circle-notch fa-spin"></i> Loading...
    </div>
    <p class="admin-empty" v-else-if="!settings">No settings configured.</p>
  </div>
</template>

<style scoped>
.admin-page-title {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-6);
}

.settings-list {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border-width-default) solid var(--border);
  gap: var(--space-4);
}

.settings-row:last-child { border-bottom: none; }

.settings-label { display: flex; flex-direction: column; gap: 2px; }
.settings-key { font-size: var(--text-sm); font-weight: var(--font-weight-semibold); }
.settings-key-mono { font-size: var(--text-sm); font-family: var(--font-mono); }
.settings-desc { font-size: var(--text-xs); color: var(--text-faint); }

.settings-value-col { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
.settings-value { font-size: var(--text-sm); font-family: var(--font-mono); color: var(--text-dim); }
.settings-input { font-size: var(--text-sm); padding: 4px 8px; border: var(--border-width-default) solid var(--border); background: var(--surface2); color: var(--text); font-family: var(--font-mono); min-width: 160px; }

.settings-custom { margin-top: var(--space-6); }
.settings-section-title { font-size: var(--text-md); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-3); }

.settings-add {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 2px dashed var(--border);
  background: var(--surface);
}

.admin-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--space-8, 32px);
  color: var(--text-faint);
}

.admin-empty {
  color: var(--text-faint);
  text-align: center;
  padding: var(--space-8) 0;
}

@media (max-width: 768px) {
  .settings-row { flex-direction: column; align-items: flex-start; gap: var(--space-1); }
  .settings-add { flex-direction: column; }
}
</style>
