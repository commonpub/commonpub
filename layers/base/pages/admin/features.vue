<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Feature Flags — Admin — ${useSiteName()}` });

const toast = useToast();

interface FlagInfo {
  enabled: boolean;
  isOverridden: boolean;
}

const { data, refresh } = await useFetch<{
  flags: Record<string, FlagInfo>;
  overrides: Record<string, boolean>;
}>('/api/admin/features');

const saving = ref(false);
const pendingChanges = ref<Record<string, boolean>>({});

const flagMeta: Record<string, { label: string; description: string; icon: string }> = {
  content: { label: 'Content', description: 'Content system (CRUD, publishing)', icon: 'fa-solid fa-newspaper' },
  social: { label: 'Social', description: 'Likes, comments, bookmarks, follows', icon: 'fa-solid fa-heart' },
  hubs: { label: 'Hubs', description: 'Communities, products, companies', icon: 'fa-solid fa-layer-group' },
  docs: { label: 'Docs', description: 'Documentation sites with versioning', icon: 'fa-solid fa-book' },
  video: { label: 'Video', description: 'Video content and categories', icon: 'fa-solid fa-video' },
  contests: { label: 'Contests', description: 'Contest system with judging', icon: 'fa-solid fa-trophy' },
  learning: { label: 'Learning', description: 'Learning paths and courses', icon: 'fa-solid fa-graduation-cap' },
  explainers: { label: 'Explainers', description: 'Interactive explainer modules', icon: 'fa-solid fa-lightbulb' },
  editorial: { label: 'Editorial', description: 'Staff picks and content categories', icon: 'fa-solid fa-pen-fancy' },
  federation: { label: 'Federation', description: 'ActivityPub federation', icon: 'fa-solid fa-globe' },
  seamlessFederation: { label: 'Seamless Federation', description: 'Mix federated content into feeds', icon: 'fa-solid fa-arrows-spin' },
  federateHubs: { label: 'Federate Hubs', description: 'Hub federation via AP Groups', icon: 'fa-solid fa-diagram-project' },
  admin: { label: 'Admin Panel', description: 'Admin dashboard and management', icon: 'fa-solid fa-shield-halved' },
  emailNotifications: { label: 'Email Notifications', description: 'Email digests and instant notifications', icon: 'fa-solid fa-envelope' },
};

const flagKeys = computed(() => data.value ? Object.keys(data.value.flags) : []);

function getEffectiveValue(key: string): boolean {
  if (key in pendingChanges.value) return pendingChanges.value[key]!;
  return data.value?.flags[key]?.enabled ?? false;
}

function isOverridden(key: string): boolean {
  if (key in pendingChanges.value) return true;
  return data.value?.flags[key]?.isOverridden ?? false;
}

function toggleFlag(key: string): void {
  const current = getEffectiveValue(key);
  pendingChanges.value = { ...pendingChanges.value, [key]: !current };
}

function resetFlag(key: string): void {
  const changes = { ...pendingChanges.value };
  delete changes[key];
  pendingChanges.value = changes;
}

const hasPendingChanges = computed(() => Object.keys(pendingChanges.value).length > 0);

async function saveChanges(): Promise<void> {
  if (!hasPendingChanges.value) return;
  saving.value = true;

  try {
    // Build the full overrides object: existing overrides + pending changes
    const currentOverrides = data.value?.overrides ?? {};
    const merged = { ...currentOverrides, ...pendingChanges.value };

    await $fetch('/api/admin/features', {
      method: 'PUT',
      body: { overrides: merged },
    });

    toast.success('Feature flags updated');
    pendingChanges.value = {};
    await refresh();
  } catch {
    toast.error('Failed to update feature flags');
  } finally {
    saving.value = false;
  }
}

async function resetOverride(key: string): Promise<void> {
  try {
    // Remove this key from overrides
    const currentOverrides = { ...(data.value?.overrides ?? {}) };
    delete currentOverrides[key];

    await $fetch('/api/admin/features', {
      method: 'PUT',
      body: { overrides: currentOverrides },
    });

    toast.success(`Reset ${flagMeta[key]?.label ?? key} to default`);
    resetFlag(key);
    await refresh();
  } catch {
    toast.error('Failed to reset flag');
  }
}
</script>

<template>
  <div class="cpub-admin-features">
    <div class="cpub-admin-header">
      <div>
        <h1 class="cpub-admin-title">Feature Flags</h1>
        <p class="cpub-admin-subtitle">Toggle features on or off at runtime. Changes take effect within 60 seconds.</p>
      </div>
      <button
        v-if="hasPendingChanges"
        class="cpub-btn cpub-btn-primary cpub-btn-sm"
        :disabled="saving"
        @click="saveChanges"
      >
        <i :class="saving ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i>
        Save Changes
      </button>
    </div>

    <div v-if="data?.flags" class="cpub-flags-list">
      <div
        v-for="key in flagKeys"
        :key="key"
        class="cpub-flag-row"
        :class="{
          'cpub-flag-row--changed': key in pendingChanges,
          'cpub-flag-row--overridden': isOverridden(key) && !(key in pendingChanges),
        }"
      >
        <div class="cpub-flag-info">
          <div class="cpub-flag-icon">
            <i :class="flagMeta[key]?.icon ?? 'fa-solid fa-toggle-on'"></i>
          </div>
          <div class="cpub-flag-text">
            <span class="cpub-flag-label">{{ flagMeta[key]?.label ?? key }}</span>
            <span class="cpub-flag-desc">{{ flagMeta[key]?.description ?? '' }}</span>
          </div>
        </div>

        <div class="cpub-flag-controls">
          <span v-if="isOverridden(key) && !(key in pendingChanges)" class="cpub-flag-badge cpub-flag-badge--override">
            overridden
          </span>
          <span v-if="key in pendingChanges" class="cpub-flag-badge cpub-flag-badge--pending">
            unsaved
          </span>

          <button
            v-if="data.flags[key]?.isOverridden && !(key in pendingChanges)"
            class="cpub-flag-reset"
            title="Reset to default"
            @click="resetOverride(key)"
          >
            <i class="fa-solid fa-rotate-left"></i>
          </button>

          <button
            class="cpub-flag-toggle"
            :class="{ 'cpub-flag-toggle--on': getEffectiveValue(key) }"
            :aria-pressed="getEffectiveValue(key)"
            :aria-label="`Toggle ${flagMeta[key]?.label ?? key}`"
            @click="toggleFlag(key)"
          >
            <span class="cpub-flag-toggle-track">
              <span class="cpub-flag-toggle-thumb" />
            </span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="hasPendingChanges" class="cpub-flags-footer">
      <span class="cpub-flags-footer-text">{{ Object.keys(pendingChanges).length }} unsaved change(s)</span>
      <button class="cpub-btn cpub-btn-sm" @click="pendingChanges = {}">Discard</button>
      <button class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="saving" @click="saveChanges">
        Save Changes
      </button>
    </div>
  </div>
</template>

<style scoped>
.cpub-admin-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-6); gap: var(--space-4); }
.cpub-admin-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); }
.cpub-admin-subtitle { font-size: 12px; color: var(--text-dim); margin-top: 4px; }

.cpub-flags-list {
  display: flex;
  flex-direction: column;
  border: var(--border-width-default) solid var(--border);
}

.cpub-flag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: var(--border-width-default) solid var(--border2);
  gap: var(--space-4);
}

.cpub-flag-row:last-child { border-bottom: none; }

.cpub-flag-row--changed {
  background: var(--yellow-bg, var(--surface2));
}

.cpub-flag-row--overridden {
  background: var(--accent-bg);
}

.cpub-flag-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.cpub-flag-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface2);
  border: var(--border-width-default) solid var(--border2);
  color: var(--text-dim);
  font-size: 13px;
  flex-shrink: 0;
}

.cpub-flag-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cpub-flag-label { font-size: 13px; font-weight: 600; }
.cpub-flag-desc { font-size: 11px; color: var(--text-dim); }

.cpub-flag-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cpub-flag-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
}

.cpub-flag-badge--override { color: var(--accent); background: var(--accent-bg); border: var(--border-width-default) solid var(--accent-border); }
.cpub-flag-badge--pending { color: var(--yellow); background: var(--yellow-bg); border: var(--border-width-default) solid var(--yellow); }

.cpub-flag-reset {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  font-size: 11px;
  padding: 4px;
}
.cpub-flag-reset:hover { color: var(--accent); }

/* Toggle switch */
.cpub-flag-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
}

.cpub-flag-toggle-track {
  display: block;
  width: 36px;
  height: 20px;
  background: var(--border);
  border: var(--border-width-default) solid var(--border2);
  position: relative;
  transition: background 0.2s;
}

.cpub-flag-toggle--on .cpub-flag-toggle-track {
  background: var(--accent);
  border-color: var(--accent);
}

.cpub-flag-toggle-thumb {
  display: block;
  width: 14px;
  height: 14px;
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
}

.cpub-flag-toggle--on .cpub-flag-toggle-thumb {
  transform: translateX(16px);
  border-color: var(--surface);
}

.cpub-flags-footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  margin-top: var(--space-4);
  background: var(--yellow-bg, var(--surface2));
  border: var(--border-width-default) solid var(--yellow, var(--border));
}

.cpub-flags-footer-text {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--yellow, var(--text-dim));
  flex: 1;
}

@media (max-width: 768px) {
  .cpub-admin-header { flex-direction: column; }
  .cpub-flag-row { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
  .cpub-flag-controls { align-self: flex-end; }
}
</style>
