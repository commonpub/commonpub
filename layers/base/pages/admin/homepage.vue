<script setup lang="ts">
import type { HomepageSection } from '@commonpub/server';

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Homepage — Admin — ${useSiteName()}` });

const toast = useToast();
const { data, refresh } = await useFetch<HomepageSection[]>('/api/admin/homepage/sections');

const sections = ref<HomepageSection[]>([]);
const saving = ref(false);
const hasChanges = ref(false);

watch(data, (val) => {
  if (val) {
    sections.value = JSON.parse(JSON.stringify(val));
    hasChanges.value = false;
  }
}, { immediate: true });

function markChanged(): void { hasChanges.value = true; }

const SECTION_TYPES: Array<{ value: HomepageSection['type']; label: string; icon: string }> = [
  { value: 'hero', label: 'Hero Banner', icon: 'fa-solid fa-flag' },
  { value: 'editorial', label: 'Staff Picks', icon: 'fa-solid fa-pen-fancy' },
  { value: 'content-grid', label: 'Content Grid', icon: 'fa-solid fa-th-large' },
  { value: 'contests', label: 'Contests', icon: 'fa-solid fa-trophy' },
  { value: 'hubs', label: 'Hubs', icon: 'fa-solid fa-layer-group' },
  { value: 'stats', label: 'Platform Stats', icon: 'fa-solid fa-chart-bar' },
  { value: 'custom-html', label: 'Custom HTML', icon: 'fa-solid fa-code' },
];

function getTypeInfo(type: string) {
  return SECTION_TYPES.find(t => t.value === type) ?? { label: type, icon: 'fa-solid fa-puzzle-piece' };
}

function moveUp(index: number): void {
  if (index <= 0) return;
  const arr = [...sections.value];
  [arr[index - 1], arr[index]] = [arr[index]!, arr[index - 1]!];
  arr.forEach((s, i) => { s.order = i; });
  sections.value = arr;
  markChanged();
}

function moveDown(index: number): void {
  if (index >= sections.value.length - 1) return;
  const arr = [...sections.value];
  [arr[index], arr[index + 1]] = [arr[index + 1]!, arr[index]!];
  arr.forEach((s, i) => { s.order = i; });
  sections.value = arr;
  markChanged();
}

function toggleSection(index: number): void {
  sections.value[index]!.enabled = !sections.value[index]!.enabled;
  markChanged();
}

function removeSection(index: number): void {
  if (!confirm(`Remove "${sections.value[index]!.title || sections.value[index]!.type}" section?`)) return;
  sections.value.splice(index, 1);
  sections.value.forEach((s, i) => { s.order = i; });
  markChanged();
}

function addSection(): void {
  const id = `section-${Date.now()}`;
  sections.value.push({
    id,
    type: 'content-grid',
    title: 'New Section',
    enabled: true,
    order: sections.value.length,
    config: { sort: 'recent', limit: 6, columns: 3 },
  });
  markChanged();
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/admin/homepage/sections', {
      method: 'PUT',
      body: { sections: sections.value },
    });
    toast.success('Homepage saved');
    hasChanges.value = false;
    await refresh();
  } catch {
    toast.error('Failed to save homepage');
  } finally {
    saving.value = false;
  }
}

function discard(): void {
  if (data.value) {
    sections.value = JSON.parse(JSON.stringify(data.value));
    hasChanges.value = false;
  }
}

const editingId = ref<string | null>(null);
</script>

<template>
  <div class="cpub-admin-homepage">
    <div class="cpub-admin-header">
      <div>
        <h1 class="cpub-admin-title">Homepage Layout</h1>
        <p class="cpub-admin-subtitle">Reorder, enable, or disable homepage sections.</p>
      </div>
      <div class="cpub-admin-header-actions">
        <button class="cpub-btn cpub-btn-sm" @click="addSection">
          <i class="fa-solid fa-plus"></i> Add Section
        </button>
        <button
          v-if="hasChanges"
          class="cpub-btn cpub-btn-primary cpub-btn-sm"
          :disabled="saving"
          @click="save"
        >
          <i :class="saving ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-check'"></i> Save
        </button>
      </div>
    </div>

    <div class="cpub-sections-list">
      <div
        v-for="(section, idx) in sections"
        :key="section.id"
        class="cpub-section-row"
        :class="{ 'cpub-section-disabled': !section.enabled }"
      >
        <div class="cpub-section-order">
          <button class="cpub-order-btn" :disabled="idx === 0" @click="moveUp(idx)" title="Move up">
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <span class="cpub-order-num">{{ idx + 1 }}</span>
          <button class="cpub-order-btn" :disabled="idx === sections.length - 1" @click="moveDown(idx)" title="Move down">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
        </div>

        <div class="cpub-section-icon">
          <i :class="getTypeInfo(section.type).icon"></i>
        </div>

        <div class="cpub-section-info">
          <div class="cpub-section-label">{{ section.title || getTypeInfo(section.type).label }}</div>
          <div class="cpub-section-meta">
            <span class="cpub-section-type-badge">{{ getTypeInfo(section.type).label }}</span>
            <span v-if="section.config.featureGate" class="cpub-section-gate">gate: {{ section.config.featureGate }}</span>
            <span v-if="section.config.limit" class="cpub-section-gate">limit: {{ section.config.limit }}</span>
          </div>
        </div>

        <div class="cpub-section-actions">
          <button
            class="cpub-section-action"
            :title="editingId === section.id ? 'Close' : 'Edit'"
            @click="editingId = editingId === section.id ? null : section.id"
          >
            <i :class="editingId === section.id ? 'fa-solid fa-xmark' : 'fa-solid fa-pencil'"></i>
          </button>
          <button
            class="cpub-section-action"
            :class="{ 'cpub-section-action--active': section.enabled }"
            :title="section.enabled ? 'Disable' : 'Enable'"
            @click="toggleSection(idx)"
          >
            <i :class="section.enabled ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash'"></i>
          </button>
          <button class="cpub-section-action cpub-section-action--danger" title="Remove" @click="removeSection(idx)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>

        <!-- Inline editor -->
        <div v-if="editingId === section.id" class="cpub-section-editor">
          <div class="cpub-editor-grid">
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Title</label>
              <input v-model="section.title" class="cpub-editor-input" @input="markChanged" />
            </div>
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Type</label>
              <select v-model="section.type" class="cpub-editor-input" @change="markChanged">
                <option v-for="t in SECTION_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Feature Gate</label>
              <input v-model="section.config.featureGate" class="cpub-editor-input" placeholder="e.g. contests" @input="markChanged" />
            </div>
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Limit</label>
              <input v-model.number="section.config.limit" type="number" min="1" max="50" class="cpub-editor-input" @input="markChanged" />
            </div>
            <div v-if="section.type === 'content-grid'" class="cpub-editor-field">
              <label class="cpub-editor-label">Sort</label>
              <select v-model="section.config.sort" class="cpub-editor-input" @change="markChanged">
                <option value="popular">Popular</option>
                <option value="recent">Recent</option>
                <option value="featured">Featured</option>
                <option value="editorial">Editorial</option>
              </select>
            </div>
            <div v-if="section.type === 'content-grid'" class="cpub-editor-field">
              <label class="cpub-editor-label">Columns</label>
              <select v-model.number="section.config.columns" class="cpub-editor-input" @change="markChanged">
                <option :value="2">2</option>
                <option :value="3">3</option>
                <option :value="4">4</option>
              </select>
            </div>
            <div v-if="section.type === 'custom-html'" class="cpub-editor-field cpub-editor-field--full">
              <label class="cpub-editor-label">HTML Content</label>
              <textarea v-model="section.config.html" class="cpub-editor-textarea" rows="4" @input="markChanged" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasChanges" class="cpub-sections-footer">
      <span class="cpub-sections-footer-text">Unsaved changes</span>
      <button class="cpub-btn cpub-btn-sm" @click="discard">Discard</button>
      <button class="cpub-btn cpub-btn-primary cpub-btn-sm" :disabled="saving" @click="save">Save</button>
    </div>
  </div>
</template>

<style scoped>
.cpub-admin-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-6); gap: var(--space-4); }
.cpub-admin-header-actions { display: flex; gap: var(--space-2); }
.cpub-admin-title { font-size: var(--text-xl); font-weight: var(--font-weight-bold); }
.cpub-admin-subtitle { font-size: 12px; color: var(--text-dim); margin-top: 4px; }

.cpub-sections-list { display: flex; flex-direction: column; border: var(--border-width-default) solid var(--border); }

.cpub-section-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: var(--border-width-default) solid var(--border2);
  gap: 12px;
  flex-wrap: wrap;
}
.cpub-section-row:last-child { border-bottom: none; }
.cpub-section-disabled { opacity: 0.5; }

.cpub-section-order { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.cpub-order-btn { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 2px 4px; }
.cpub-order-btn:hover { color: var(--accent); }
.cpub-order-btn:disabled { opacity: 0.3; cursor: default; }
.cpub-order-num { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }

.cpub-section-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--surface2); border: var(--border-width-default) solid var(--border2); color: var(--text-dim); font-size: 13px; flex-shrink: 0; }

.cpub-section-info { flex: 1; min-width: 0; }
.cpub-section-label { font-size: 13px; font-weight: 600; }
.cpub-section-meta { display: flex; gap: 8px; margin-top: 2px; }
.cpub-section-type-badge { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--text-faint); }
.cpub-section-gate { font-family: var(--font-mono); font-size: 9px; color: var(--accent); }

.cpub-section-actions { display: flex; gap: 6px; flex-shrink: 0; }
.cpub-section-action { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.cpub-section-action:hover { color: var(--accent); }
.cpub-section-action--active { color: var(--green); }
.cpub-section-action--danger:hover { color: var(--red); }

.cpub-section-editor { width: 100%; padding: 12px 0 0; border-top: var(--border-width-default) solid var(--border2); margin-top: 8px; }
.cpub-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.cpub-editor-field { display: flex; flex-direction: column; gap: 4px; }
.cpub-editor-field--full { grid-column: 1 / -1; }
.cpub-editor-label { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
.cpub-editor-input { font-size: 13px; padding: 6px 10px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; }
.cpub-editor-input:focus { border-color: var(--accent); }
.cpub-editor-textarea { font-size: 12px; font-family: var(--font-mono); padding: 8px 10px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; resize: vertical; }

.cpub-sections-footer { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); margin-top: var(--space-4); background: var(--yellow-bg, var(--surface2)); border: var(--border-width-default) solid var(--yellow, var(--border)); }
.cpub-sections-footer-text { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--yellow, var(--text-dim)); flex: 1; }

@media (max-width: 768px) {
  .cpub-admin-header { flex-direction: column; }
  .cpub-editor-grid { grid-template-columns: 1fr; }
  .cpub-section-row { flex-direction: column; align-items: flex-start; }
  .cpub-section-actions { align-self: flex-end; }
}
</style>
