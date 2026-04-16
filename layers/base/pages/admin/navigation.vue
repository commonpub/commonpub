<script setup lang="ts">
import type { NavItem } from '@commonpub/server';

definePageMeta({ layout: 'admin', middleware: 'auth' });
useSeoMeta({ title: `Navigation — Admin — ${useSiteName()}` });

const toast = useToast();
const { data, refresh } = await useFetch<NavItem[]>('/api/admin/navigation/items');

const items = ref<NavItem[]>([]);
const saving = ref(false);
const hasChanges = ref(false);

watch(data, (val) => {
  if (val) {
    items.value = JSON.parse(JSON.stringify(val));
    hasChanges.value = false;
  }
}, { immediate: true });

function markChanged(): void { hasChanges.value = true; }

const NAV_TYPES: Array<{ value: NavItem['type']; label: string }> = [
  { value: 'link', label: 'Internal Link' },
  { value: 'dropdown', label: 'Dropdown Menu' },
  { value: 'external', label: 'External Link' },
];

const VISIBILITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'authenticated', label: 'Logged-in users' },
  { value: 'admin', label: 'Admins only' },
];

function moveUp(index: number): void {
  if (index <= 0) return;
  const arr = [...items.value];
  [arr[index - 1], arr[index]] = [arr[index]!, arr[index - 1]!];
  items.value = arr;
  markChanged();
}

function moveDown(index: number): void {
  if (index >= items.value.length - 1) return;
  const arr = [...items.value];
  [arr[index], arr[index + 1]] = [arr[index + 1]!, arr[index]!];
  items.value = arr;
  markChanged();
}

function removeItem(index: number): void {
  if (!confirm(`Remove "${items.value[index]!.label}" from navigation?`)) return;
  items.value.splice(index, 1);
  markChanged();
}

function addItem(): void {
  items.value.push({
    id: `nav-${Date.now()}`,
    type: 'link',
    label: 'New Link',
    icon: 'fa-solid fa-link',
    route: '/',
  });
  markChanged();
}

function addChild(parentIndex: number): void {
  const parent = items.value[parentIndex]!;
  if (!parent.children) parent.children = [];
  parent.children.push({
    id: `nav-child-${Date.now()}`,
    type: 'link',
    label: 'New Child',
    icon: 'fa-solid fa-link',
    route: '/',
  });
  markChanged();
}

function removeChild(parentIndex: number, childIndex: number): void {
  const parent = items.value[parentIndex]!;
  if (!parent.children) return;
  parent.children.splice(childIndex, 1);
  markChanged();
}

function moveChildUp(parentIndex: number, childIndex: number): void {
  const children = items.value[parentIndex]!.children;
  if (!children || childIndex <= 0) return;
  [children[childIndex - 1], children[childIndex]] = [children[childIndex]!, children[childIndex - 1]!];
  markChanged();
}

function moveChildDown(parentIndex: number, childIndex: number): void {
  const children = items.value[parentIndex]!.children;
  if (!children || childIndex >= children.length - 1) return;
  [children[childIndex], children[childIndex + 1]] = [children[childIndex + 1]!, children[childIndex]!];
  markChanged();
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    await $fetch('/api/admin/navigation/items', {
      method: 'PUT',
      body: { items: items.value },
    });
    toast.success('Navigation saved');
    hasChanges.value = false;
    await refresh();
  } catch {
    toast.error('Failed to save navigation');
  } finally {
    saving.value = false;
  }
}

function discard(): void {
  if (data.value) {
    items.value = JSON.parse(JSON.stringify(data.value));
    hasChanges.value = false;
  }
}

const editingId = ref<string | null>(null);
</script>

<template>
  <div class="cpub-admin-nav-page">
    <div class="cpub-admin-header">
      <div>
        <h1 class="cpub-admin-title">Navigation</h1>
        <p class="cpub-admin-subtitle">Configure the main site navigation bar.</p>
      </div>
      <div class="cpub-admin-header-actions">
        <button class="cpub-btn cpub-btn-sm" @click="addItem">
          <i class="fa-solid fa-plus"></i> Add Item
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

    <div class="cpub-nav-list">
      <div
        v-for="(item, idx) in items"
        :key="item.id"
        class="cpub-nav-row"
      >
        <div class="cpub-nav-order">
          <button class="cpub-order-btn" :disabled="idx === 0" title="Move up" @click="moveUp(idx)">
            <i class="fa-solid fa-chevron-up"></i>
          </button>
          <span class="cpub-order-num">{{ idx + 1 }}</span>
          <button class="cpub-order-btn" :disabled="idx === items.length - 1" title="Move down" @click="moveDown(idx)">
            <i class="fa-solid fa-chevron-down"></i>
          </button>
        </div>

        <div class="cpub-nav-icon-cell">
          <i :class="item.icon || 'fa-solid fa-link'"></i>
        </div>

        <div class="cpub-nav-info">
          <div class="cpub-nav-label">{{ item.label }}</div>
          <div class="cpub-nav-meta">
            <span class="cpub-nav-type-badge">{{ item.type }}</span>
            <span v-if="item.route" class="cpub-nav-route">{{ item.route }}</span>
            <span v-if="item.href" class="cpub-nav-route">{{ item.href }}</span>
            <span v-if="item.featureGate" class="cpub-nav-gate">gate: {{ item.featureGate }}</span>
            <span v-if="item.visibleTo && item.visibleTo !== 'all'" class="cpub-nav-gate">{{ item.visibleTo }}</span>
            <span v-if="item.children?.length" class="cpub-nav-gate">{{ item.children.length }} children</span>
          </div>
        </div>

        <div class="cpub-nav-actions">
          <button
            class="cpub-nav-action"
            :title="editingId === item.id ? 'Close' : 'Edit'"
            @click="editingId = editingId === item.id ? null : item.id"
          >
            <i :class="editingId === item.id ? 'fa-solid fa-xmark' : 'fa-solid fa-pencil'"></i>
          </button>
          <button class="cpub-nav-action cpub-nav-action--danger" title="Remove" @click="removeItem(idx)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>

        <!-- Inline editor -->
        <div v-if="editingId === item.id" class="cpub-nav-editor">
          <div class="cpub-editor-grid">
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Label</label>
              <input v-model="item.label" class="cpub-editor-input" @input="markChanged" />
            </div>
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Type</label>
              <select v-model="item.type" class="cpub-editor-input" @change="markChanged">
                <option v-for="t in NAV_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Icon (FontAwesome class)</label>
              <input v-model="item.icon" class="cpub-editor-input" placeholder="fa-solid fa-house" @input="markChanged" />
            </div>
            <div v-if="item.type === 'link' || item.type === 'dropdown'" class="cpub-editor-field">
              <label class="cpub-editor-label">Route</label>
              <input v-model="item.route" class="cpub-editor-input" placeholder="/page" @input="markChanged" />
            </div>
            <div v-if="item.type === 'external'" class="cpub-editor-field">
              <label class="cpub-editor-label">URL</label>
              <input v-model="item.href" class="cpub-editor-input" placeholder="https://..." @input="markChanged" />
            </div>
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Feature Gate</label>
              <input v-model="item.featureGate" class="cpub-editor-input" placeholder="e.g. hubs" @input="markChanged" />
            </div>
            <div class="cpub-editor-field">
              <label class="cpub-editor-label">Visible To</label>
              <select v-model="item.visibleTo" class="cpub-editor-input" @change="markChanged">
                <option v-for="v in VISIBILITY_OPTIONS" :key="v.value" :value="v.value">{{ v.label }}</option>
              </select>
            </div>
          </div>

          <!-- Children (for dropdown type) -->
          <div v-if="item.type === 'dropdown'" class="cpub-children-section">
            <div class="cpub-children-header">
              <span class="cpub-children-title">Children</span>
              <button class="cpub-btn cpub-btn-sm" @click="addChild(idx)">
                <i class="fa-solid fa-plus"></i> Add Child
              </button>
            </div>
            <div v-if="item.children?.length" class="cpub-children-list">
              <div
                v-for="(child, ci) in item.children"
                :key="child.id"
                class="cpub-child-row"
              >
                <div class="cpub-child-order">
                  <button class="cpub-order-btn" :disabled="ci === 0" @click="moveChildUp(idx, ci)">
                    <i class="fa-solid fa-chevron-up"></i>
                  </button>
                  <button class="cpub-order-btn" :disabled="ci === (item.children?.length ?? 0) - 1" @click="moveChildDown(idx, ci)">
                    <i class="fa-solid fa-chevron-down"></i>
                  </button>
                </div>
                <div class="cpub-child-fields">
                  <input v-model="child.label" class="cpub-editor-input cpub-child-input" placeholder="Label" @input="markChanged" />
                  <input v-model="child.icon" class="cpub-editor-input cpub-child-input" placeholder="Icon class" @input="markChanged" />
                  <input v-model="child.route" class="cpub-editor-input cpub-child-input" placeholder="Route" @input="markChanged" />
                  <input v-model="child.featureGate" class="cpub-editor-input cpub-child-input" placeholder="Feature gate" @input="markChanged" />
                  <label class="cpub-child-disabled-label">
                    <input type="checkbox" v-model="child.disabled" @change="markChanged" /> Disabled
                  </label>
                </div>
                <button class="cpub-nav-action cpub-nav-action--danger" title="Remove child" @click="removeChild(idx, ci)">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
            <p v-else class="cpub-children-empty">No children. Add items to populate this dropdown.</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasChanges" class="cpub-nav-footer">
      <span class="cpub-nav-footer-text">Unsaved changes</span>
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

.cpub-nav-list { display: flex; flex-direction: column; border: var(--border-width-default) solid var(--border); }

.cpub-nav-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: var(--border-width-default) solid var(--border2);
  gap: 12px;
  flex-wrap: wrap;
}
.cpub-nav-row:last-child { border-bottom: none; }

.cpub-nav-order { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.cpub-order-btn { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 10px; padding: 2px 4px; }
.cpub-order-btn:hover { color: var(--accent); }
.cpub-order-btn:disabled { opacity: 0.3; cursor: default; }
.cpub-order-num { font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); }

.cpub-nav-icon-cell { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--surface2); border: var(--border-width-default) solid var(--border2); color: var(--text-dim); font-size: 13px; flex-shrink: 0; }

.cpub-nav-info { flex: 1; min-width: 0; }
.cpub-nav-label { font-size: 13px; font-weight: 600; }
.cpub-nav-meta { display: flex; gap: 8px; margin-top: 2px; flex-wrap: wrap; }
.cpub-nav-type-badge { font-family: var(--font-mono); font-size: 9px; text-transform: uppercase; color: var(--text-faint); }
.cpub-nav-route { font-family: var(--font-mono); font-size: 9px; color: var(--text-dim); }
.cpub-nav-gate { font-family: var(--font-mono); font-size: 9px; color: var(--accent); }

.cpub-nav-actions { display: flex; gap: 6px; flex-shrink: 0; }
.cpub-nav-action { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 12px; padding: 4px 6px; }
.cpub-nav-action:hover { color: var(--accent); }
.cpub-nav-action--danger:hover { color: var(--red); }

.cpub-nav-editor { width: 100%; padding: 12px 0 0; border-top: var(--border-width-default) solid var(--border2); margin-top: 8px; }
.cpub-editor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.cpub-editor-field { display: flex; flex-direction: column; gap: 4px; }
.cpub-editor-label { font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
.cpub-editor-input { font-size: 13px; padding: 6px 10px; border: var(--border-width-default) solid var(--border); background: var(--bg); color: var(--text); outline: none; }
.cpub-editor-input:focus { border-color: var(--accent); }

.cpub-children-section { margin-top: var(--space-4); padding-top: var(--space-3); border-top: var(--border-width-default) solid var(--border2); }
.cpub-children-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.cpub-children-title { font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-faint); }
.cpub-children-list { display: flex; flex-direction: column; gap: 8px; }
.cpub-child-row { display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--surface2); border: var(--border-width-default) solid var(--border2); }
.cpub-child-order { display: flex; flex-direction: column; gap: 2px; }
.cpub-child-fields { display: flex; gap: 6px; flex: 1; flex-wrap: wrap; align-items: center; }
.cpub-child-input { flex: 1; min-width: 100px; font-size: 12px; padding: 4px 8px; }
.cpub-child-disabled-label { font-size: 11px; color: var(--text-dim); display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.cpub-children-empty { font-size: 12px; color: var(--text-faint); font-style: italic; }

.cpub-nav-footer { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); margin-top: var(--space-4); background: var(--yellow-bg, var(--surface2)); border: var(--border-width-default) solid var(--yellow, var(--border)); }
.cpub-nav-footer-text { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--yellow, var(--text-dim)); flex: 1; }

@media (max-width: 768px) {
  .cpub-admin-header { flex-direction: column; }
  .cpub-editor-grid { grid-template-columns: 1fr; }
  .cpub-nav-row { flex-direction: column; align-items: flex-start; }
  .cpub-nav-actions { align-self: flex-end; }
  .cpub-child-fields { flex-direction: column; }
  .cpub-child-input { min-width: 0; }
}
</style>
