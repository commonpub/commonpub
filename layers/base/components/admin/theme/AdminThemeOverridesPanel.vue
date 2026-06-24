<script setup lang="ts">
/**
 * Legacy "token overrides" panel — applies on top of whichever theme is
 * active. Useful for one-off tweaks ("flip the accent for our anniversary
 * week") without authoring a full custom theme. For real edits, the
 * editor at `/admin/theme/edit/[id]` is the better tool.
 *
 * Self-contained: takes the initial map from a prop, owns the in-progress
 * draft, emits `save` with the final map. The parent persists via
 * `/api/admin/settings` and decides when to refresh.
 */
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  /** Initial map from `instance_settings.theme.token_overrides`. */
  initial: Record<string, string>;
  /** Disables save buttons while a parent-driven request is in flight. */
  saving: boolean;
}>();

const emit = defineEmits<{
  save: [overrides: Record<string, string>];
}>();

const draft = ref<Record<string, string>>({ ...props.initial });
const newKey = ref('');
const newValue = ref('');

watch(() => props.initial, (next) => {
  // Reset draft when the parent reloads settings (e.g. after a save round-trip)
  draft.value = { ...next };
});

const count = computed(() => Object.keys(draft.value).length);
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.initial));

function addOverride(): void {
  const k = newKey.value.trim().replace(/^--/, '');
  const v = newValue.value.trim();
  if (!k || !v) return;
  draft.value = { ...draft.value, [k]: v };
  newKey.value = '';
  newValue.value = '';
}

function removeOverride(key: string): void {
  const next = { ...draft.value };
  delete next[key];
  draft.value = next;
}

function looksLikeColor(value: string): boolean {
  return value.startsWith('#') || value.startsWith('rgb');
}
</script>

<template>
  <details class="admin-theme-overrides">
    <summary class="admin-theme-overrides-summary">
      <i class="fa-solid fa-sliders" aria-hidden="true" />
      <span>Token overrides</span>
      <span v-if="count > 0" class="admin-theme-overrides-count">{{ count }} active</span>
    </summary>
    <div class="admin-theme-overrides-body">
      <p class="admin-theme-overrides-desc">
        Ad-hoc overrides applied on top of whichever theme is active. Useful for
        one-off tweaks without authoring a full custom theme. For real edits,
        create or fork a theme above.
      </p>

      <div v-if="count > 0" class="admin-overrides-list">
        <div v-for="(value, key) in draft" :key="key" class="admin-override-row">
          <code class="admin-override-key">--{{ key }}</code>
          <span class="admin-override-value">
            <span
              v-if="looksLikeColor(String(value))"
              class="admin-override-swatch"
              :style="{ backgroundColor: String(value) }"
            />
            {{ value }}
          </span>
          <button
            class="cpub-btn cpub-btn-sm admin-override-remove"
            :aria-label="`Remove override for ${key}`"
            @click="removeOverride(key as string)"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="admin-override-add">
        <input v-model="newKey" class="admin-override-input" placeholder="Token name (e.g. accent)" @keyup.enter="addOverride" />
        <input v-model="newValue" class="admin-override-input" placeholder="Value (e.g. #ff6600)" @keyup.enter="addOverride" />
        <button class="cpub-btn cpub-btn-sm" :disabled="!newKey.trim() || !newValue.trim()" @click="addOverride">Add</button>
      </div>

      <div class="admin-override-actions">
        <button class="cpub-btn cpub-btn-primary" :disabled="saving || !dirty" @click="emit('save', draft)">
          <i class="fa-solid fa-floppy-disk" aria-hidden="true" /> Save overrides
        </button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.admin-theme-overrides {
  margin-top: var(--space-6);
  border-top: var(--border-width-default) solid var(--border);
  padding-top: var(--space-4);
}

.admin-theme-overrides-summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-md);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
  cursor: pointer;
  padding: var(--space-2);
  list-style: none;
}
.admin-theme-overrides-summary::-webkit-details-marker { display: none; }
.admin-theme-overrides-summary::before {
  content: '\f054'; /* fa-chevron-right */
  font-family: 'Font Awesome 6 Free';
  font-weight: 900;
  font-size: 12px;
  color: var(--text-dim);
  transition: transform var(--transition-fast);
}
[open] > .admin-theme-overrides-summary::before { transform: rotate(90deg); }

.admin-theme-overrides-count {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  padding: 1px 6px;
  background: var(--accent-bg);
  color: var(--accent);
  border: var(--border-width-thin) solid var(--accent-border);
}

.admin-theme-overrides-body { padding: var(--space-3) 0; }
.admin-theme-overrides-desc {
  font-size: var(--text-sm);
  color: var(--text-dim);
  margin: 0 0 var(--space-3);
  max-width: 560px;
  line-height: var(--leading-snug);
}

.admin-overrides-list {
  border: var(--border-width-default) solid var(--border);
  background: var(--surface);
  margin-bottom: var(--space-3);
}
.admin-override-row {
  display: flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width-thin) solid var(--border2);
  gap: var(--space-3);
}
.admin-override-row:last-child { border-bottom: 0; }
.admin-override-key {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--accent);
  flex-shrink: 0;
}
.admin-override-value {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.admin-override-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: var(--border-width-thin) solid var(--border2);
  flex-shrink: 0;
}
.admin-override-remove { flex-shrink: 0; padding: var(--space-1); color: var(--text-faint); }
.admin-override-remove:hover { color: var(--red-text); }

.admin-override-add {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 2px dashed var(--border2);
  background: var(--surface);
  margin-bottom: var(--space-3);
}
.admin-override-input {
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  border: var(--border-width-default) solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-family: var(--font-mono);
  flex: 1;
  min-width: 0;
}

.admin-override-actions { margin-top: var(--space-3); }

@media (max-width: 640px) {
  .admin-override-add { flex-direction: column; }
}
</style>
