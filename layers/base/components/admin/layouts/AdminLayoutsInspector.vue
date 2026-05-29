<script setup lang="ts">
/**
 * Inspector — right column of the editor shell. 3-way dispatcher on the
 * editor's current selection (Phase 3e):
 *   - nothing selected → page-meta form (<AdminLayoutsInspectorPage>)
 *   - section selected → section config auto-form (<AdminLayoutsInspectorSection>)
 *   - row selected     → row config auto-form (<AdminLayoutsInspectorRow>)
 *
 * The selected section/row are resolved from `draft` by id so the
 * inspector stays a pure function of (draft, selection) — no duplicated
 * selection state. A stale selection (id no longer in draft, e.g. another
 * admin deleted it) falls back to the page-meta form.
 *
 * Config edits bubble as `update:section-config` / `update:row-config`
 * with `{ id, config }`; the editor page mutates the draft (auto-save
 * picks up the dirty flag). Page-meta + name edits keep their existing
 * emits unchanged.
 */
import type { LayoutRecord, LayoutSectionResolved, LayoutRowResolved } from '@commonpub/server';
import type { EditorSelection } from '../../../composables/useLayoutEditor';

const props = defineProps<{
  draft: LayoutRecord | null;
  selection: EditorSelection;
}>();

const emit = defineEmits<{
  (e: 'update:page-meta', value: LayoutRecord['pageMeta']): void;
  (e: 'update:name', value: string): void;
  (e: 'update:section-config', value: { id: string; config: Record<string, unknown> }): void;
  (e: 'update:row-config', value: { id: string; config: Record<string, unknown> }): void;
}>();

/** Locate the selected section in the draft (or null if absent/stale). */
const selectedSection = computed<LayoutSectionResolved | null>(() => {
  const sel = props.selection;
  if (!sel || sel.kind !== 'section' || !props.draft) return null;
  for (const zone of props.draft.zones) {
    for (const row of zone.rows) {
      const found = row.sections.find((s) => s.id === sel.id);
      if (found) return found;
    }
  }
  return null;
});

/** Locate the selected row in the draft (or null if absent/stale). */
const selectedRow = computed<LayoutRowResolved | null>(() => {
  const sel = props.selection;
  if (!sel || sel.kind !== 'row' || !props.draft) return null;
  for (const zone of props.draft.zones) {
    const found = zone.rows.find((r) => r.id === sel.id);
    if (found) return found;
  }
  return null;
});

/** Which branch the dispatcher renders — also drives the header hint. */
const mode = computed<'loading' | 'page' | 'section' | 'row'>(() => {
  if (!props.draft) return 'loading';
  if (selectedSection.value) return 'section';
  if (selectedRow.value) return 'row';
  return 'page';
});

const hint = computed<string>(() => {
  switch (mode.value) {
    case 'section': return 'Editing the selected section. Click empty canvas to edit page meta.';
    case 'row': return 'Editing the selected row. Click empty canvas to edit page meta.';
    default: return 'Page meta. Select a section or row to edit its content.';
  }
});

function onPageMetaUpdate(value: LayoutRecord['pageMeta']): void {
  emit('update:page-meta', value);
}
function onNameUpdate(value: string): void {
  emit('update:name', value);
}
function onSectionConfigUpdate(config: Record<string, unknown>): void {
  const s = selectedSection.value;
  if (s) emit('update:section-config', { id: s.id, config });
}
function onRowConfigUpdate(config: Record<string, unknown>): void {
  const r = selectedRow.value;
  if (r) emit('update:row-config', { id: r.id, config });
}
</script>

<template>
  <aside class="cpub-admin-layouts-inspector" aria-label="Inspector">
    <header class="cpub-admin-layouts-inspector-header">
      <h2 class="cpub-admin-layouts-inspector-title">Inspector</h2>
      <p class="cpub-admin-layouts-inspector-hint">{{ hint }}</p>
    </header>

    <div v-if="mode === 'loading'" class="cpub-admin-layouts-inspector-loading">
      <i class="fa-solid fa-circle-notch fa-spin"></i>
      <span>Loading…</span>
    </div>

    <AdminLayoutsInspectorSection
      v-else-if="mode === 'section' && selectedSection"
      :section="selectedSection"
      @update:config="onSectionConfigUpdate"
    />

    <AdminLayoutsInspectorRow
      v-else-if="mode === 'row' && selectedRow"
      :row="selectedRow"
      @update:config="onRowConfigUpdate"
    />

    <AdminLayoutsInspectorPage
      v-else-if="draft"
      :draft="draft"
      @update:page-meta="onPageMetaUpdate"
      @update:name="onNameUpdate"
    />
  </aside>
</template>

<style scoped>
.cpub-admin-layouts-inspector {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--surface);
  border-left: var(--border-width-default) solid var(--border);
  overflow-y: auto;
  height: 100%;
}

.cpub-admin-layouts-inspector-header { border-bottom: 1px solid var(--border2); padding-bottom: var(--space-3); }
.cpub-admin-layouts-inspector-title {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--text-dim);
  margin: 0 0 var(--space-1) 0;
  font-weight: var(--font-weight-semibold);
}
.cpub-admin-layouts-inspector-hint {
  font-size: var(--text-xs);
  color: var(--text-faint);
  margin: 0;
}

.cpub-admin-layouts-inspector-loading {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-4);
  color: var(--text-faint);
  font-size: var(--text-sm);
}
</style>
