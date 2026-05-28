<script setup lang="ts">
/**
 * /admin/layouts/[id] — editor shell (Phase 3a.3).
 *
 * Three-column orchestrator: palette (left), canvas (center, hosts
 * <LayoutSlot :editable previewOverride=draft>), inspector (right).
 *
 * State lives in `useLayoutEditor(id)` — draft + original + dirty +
 * save/publish/refresh/discard. The toolbar (3a.5) + auto-save
 * (3a.6) bind to that composable. The InspectorPage edits mutate
 * the draft in place; the draft ref drives the canvas re-render.
 *
 * NO drag-drop, NO click-to-select in 3a.3 — those live in 3b + 3d.
 * The visual chrome from LayoutSlot's :editable prop (3a.1) is the
 * affordance admins see in this phase.
 */
import type { LayoutRecord } from '@commonpub/server';

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin-layouts'],
});

const route = useRoute();
const id = computed<string>(() => String(route.params.id));

const editor = useLayoutEditor(id.value);

// SSR-prime: fetch the layout via useFetch (hydration-safe), then
// hand it to the editor composable. The composable also exposes
// refresh() for client-only re-fetches (after publish, etc).
const { data: initial, error } = await useFetch<LayoutRecord>(
  `/api/admin/layouts/${id.value}`,
);
if (initial.value) {
  editor.original.value = initial.value;
  editor.draft.value = JSON.parse(JSON.stringify(initial.value));
}

useSeoMeta({
  title: () => `Edit: ${editor.draft.value?.name ?? 'Layout'} — Admin — ${useSiteName()}`,
});

function onPageMetaUpdate(value: LayoutRecord['pageMeta']): void {
  if (!editor.draft.value) return;
  editor.draft.value.pageMeta = value;
}
function onNameUpdate(value: string): void {
  if (!editor.draft.value) return;
  editor.draft.value.name = value;
}
</script>

<template>
  <div class="cpub-admin-layouts-editor">
    <div v-if="error" class="cpub-admin-layouts-editor-error">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>Failed to load layout. <NuxtLink to="/admin/layouts">Back to layouts</NuxtLink></p>
    </div>

    <template v-else>
      <header class="cpub-admin-layouts-editor-toolbar">
        <NuxtLink to="/admin/layouts" class="cpub-admin-layouts-editor-back">
          <i class="fa-solid fa-chevron-left"></i>
          <span>Layouts</span>
        </NuxtLink>
        <div class="cpub-admin-layouts-editor-toolbar-title">
          <span class="cpub-admin-layouts-editor-toolbar-name">{{ editor.draft.value?.name ?? '—' }}</span>
          <span
            v-if="editor.draft.value"
            class="cpub-admin-layouts-editor-toolbar-state"
            :data-state="editor.draft.value.state"
          >{{ editor.draft.value.state }}</span>
        </div>
        <div class="cpub-admin-layouts-editor-toolbar-status">
          <span v-if="editor.dirty.value" class="cpub-admin-layouts-editor-dirty">Unsaved changes</span>
          <span v-else-if="editor.status.value === 'saved'" class="cpub-admin-layouts-editor-saved">Saved</span>
        </div>
      </header>

      <div class="cpub-admin-layouts-editor-body">
        <AdminLayoutsPalette />
        <AdminLayoutsCanvas :layout="editor.draft.value" viewport="desktop" />
        <AdminLayoutsInspector
          :draft="editor.draft.value"
          @update:page-meta="onPageMetaUpdate"
          @update:name="onNameUpdate"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.cpub-admin-layouts-editor {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--admin-topbar-height, 56px));
  min-height: 600px;
}

.cpub-admin-layouts-editor-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8);
  color: var(--text-dim);
}
.cpub-admin-layouts-editor-error a { color: var(--accent); text-decoration: underline; }

.cpub-admin-layouts-editor-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--surface);
  border-bottom: var(--border-width-default) solid var(--border);
  flex: 0 0 auto;
}

.cpub-admin-layouts-editor-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-dim);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}
.cpub-admin-layouts-editor-back:hover { color: var(--accent); }

.cpub-admin-layouts-editor-toolbar-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}
.cpub-admin-layouts-editor-toolbar-name {
  font-size: var(--text-base);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cpub-admin-layouts-editor-toolbar-state {
  display: inline-block;
  padding: 2px var(--space-2);
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  border: 1px solid var(--border2);
}
.cpub-admin-layouts-editor-toolbar-state[data-state='published'] { color: var(--accent); border-color: var(--accent); }
.cpub-admin-layouts-editor-toolbar-state[data-state='draft'] { color: var(--text-dim); }

.cpub-admin-layouts-editor-toolbar-status {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-faint);
}
.cpub-admin-layouts-editor-dirty { color: var(--text-dim); }
.cpub-admin-layouts-editor-saved { color: var(--accent); }

.cpub-admin-layouts-editor-body {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  flex: 1;
  min-height: 0;
}

@media (max-width: 1280px) {
  .cpub-admin-layouts-editor-body { grid-template-columns: 240px 1fr 280px; }
}

@media (max-width: 1024px) {
  .cpub-admin-layouts-editor-body { grid-template-columns: 1fr; }
  /* On tablet/phone the palette + inspector collapse; v1 doesn't ship
     bottom-sheet behavior (Phase 6a) — they stack below the canvas. */
}
</style>
