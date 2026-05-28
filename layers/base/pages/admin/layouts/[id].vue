<script setup lang="ts">
/**
 * /admin/layouts/[id] — editor shell (Phase 3a.3 + 3a.5).
 *
 * Three-column orchestrator with a sticky top toolbar:
 *   - Toolbar (3a.5): back-link + name + state + viewport segmented
 *     control + save indicator + Save/Publish buttons
 *   - Palette (left) — every registered section, grouped by category
 *   - Canvas (center) — <LayoutSlot :editable previewOverride=draft>
 *   - Inspector (right) — page-meta form (3a.4); section/row forms
 *     arrive alongside drag-drop in 3b/3f
 *
 * State lives in `useLayoutEditor(id)` — draft + original + dirty +
 * save/publish/refresh/discard. Auto-save (3a.6) is wired through
 * `useLayoutAutoSave` watching `editor.dirty`.
 */
import type { LayoutRecord } from '@commonpub/server';

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin-layouts'],
});

const route = useRoute();
const toast = useToast();
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

// Viewport preview state — purely UI; doesn't mutate the layout.
const viewport = ref<'mobile' | 'tablet' | 'desktop'>('desktop');

// Conflict modal visibility — flips true when save() returns 409.
const conflictOpen = ref<boolean>(false);

// Auto-save: watches editor.dirty, debounces 1.5s, calls editor.save().
// Composable handles unmount cleanup.
useLayoutAutoSave({
  dirty: editor.dirty,
  save: () => editor.save(),
  debounceMs: 1500,
});

// Surface conflicts from any save (manual or auto) as the modal.
watch(editor.status, (status) => {
  if (status === 'conflict') conflictOpen.value = true;
});

function onPageMetaUpdate(value: LayoutRecord['pageMeta']): void {
  if (!editor.draft.value) return;
  editor.draft.value.pageMeta = value;
}
function onNameUpdate(value: string): void {
  if (!editor.draft.value) return;
  editor.draft.value.name = value;
}

async function onSave(): Promise<void> {
  try {
    await editor.save();
    toast.success('Layout saved');
  } catch (err) {
    const e = err as { statusCode?: number; statusMessage?: string };
    if (e.statusCode === 409) {
      // Modal is already open via the status watcher; no toast (modal is louder).
      return;
    }
    toast.error(e.statusMessage ?? 'Save failed');
  }
}

async function onPublish(): Promise<void> {
  if (!confirm('Publish this layout? The current draft replaces the live version.')) return;
  try {
    await editor.publish();
    toast.success('Layout published');
  } catch (err) {
    const e = err as { statusMessage?: string };
    toast.error(e.statusMessage ?? 'Publish failed');
  }
}

async function onConflictRefresh(): Promise<void> {
  conflictOpen.value = false;
  try {
    await editor.refresh();
    toast.success('Refreshed — server state loaded');
  } catch (err) {
    const e = err as { statusMessage?: string };
    toast.error(e.statusMessage ?? 'Refresh failed');
  }
}

async function onConflictForceSave(): Promise<void> {
  conflictOpen.value = false;
  try {
    await editor.save({ force: true });
    toast.success('Layout force-saved');
  } catch (err) {
    const e = err as { statusMessage?: string };
    toast.error(e.statusMessage ?? 'Force save failed');
  }
}
</script>

<template>
  <div class="cpub-admin-layouts-editor">
    <div v-if="error" class="cpub-admin-layouts-editor-error">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>Failed to load layout. <NuxtLink to="/admin/layouts">Back to layouts</NuxtLink></p>
    </div>

    <template v-else>
      <AdminLayoutsToolbar
        :layout-name="editor.draft.value?.name ?? ''"
        :state="editor.draft.value?.state ?? 'draft'"
        :viewport="viewport"
        :save-status="editor.status.value"
        :dirty="editor.dirty.value"
        :error-message="editor.errorMessage.value"
        @update:viewport="viewport = $event"
        @save="onSave"
        @publish="onPublish"
      />

      <div class="cpub-admin-layouts-editor-body">
        <AdminLayoutsPalette />
        <AdminLayoutsCanvas :layout="editor.draft.value" :viewport="viewport" />
        <AdminLayoutsInspector
          :draft="editor.draft.value"
          @update:page-meta="onPageMetaUpdate"
          @update:name="onNameUpdate"
        />
      </div>

      <AdminLayoutsConflictModal
        :open="conflictOpen"
        :message="editor.errorMessage.value"
        @refresh="onConflictRefresh"
        @force-save="onConflictForceSave"
        @close="conflictOpen = false"
      />
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
