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
        :last-saved-at="editor.original.value?.updatedAt ?? null"
        @update:viewport="viewport = $event"
        @save="onSave"
        @publish="onPublish"
      />

      <!--
        Round-3 audit fix: phone (<640px) sees a single banner instead
        of the editor. Drag-drop on a 375px viewport is user-hostile
        regardless of how well-designed — matches docs/plans/layout-and-pages.md §7.7.
      -->
      <div class="cpub-admin-layouts-editor-phone-only">
        <i class="fa-solid fa-display cpub-admin-layouts-editor-phone-icon" aria-hidden="true"></i>
        <h2>Use a larger screen</h2>
        <p>The layout editor needs a tablet or desktop viewport (640px or wider).</p>
        <NuxtLink to="/admin/layouts" class="cpub-admin-layouts-editor-phone-back">← Back to Layouts</NuxtLink>
      </div>

      <div class="cpub-admin-layouts-editor-body">
        <!-- Tablet/phone collapse: canvas FIRST so the surface admin came
             for is immediately visible; palette + inspector stack below.
             (Pre-audit ordering put palette first → admin had to scroll
             past 17 tiles to reach the canvas.) -->
        <AdminLayoutsCanvas :layout="editor.draft.value" :viewport="viewport" />
        <AdminLayoutsPalette />
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
  /* The admin layout (.admin-main) wraps us in `padding: var(--space-6)`,
     which would inset the editor + cause its 100vh-based height to
     overflow the viewport. Suck up to the parent padding edges so the
     editor reads as full-bleed inside the admin chrome. */
  margin: calc(var(--space-6) * -1);
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
  /* DOM order: canvas, palette, inspector. CSS grid-template-areas
     places them visually palette / canvas / inspector at >=1024px. */
  grid-template-columns: 280px 1fr 320px;
  grid-template-areas: 'palette canvas inspector';
  flex: 1;
  min-height: 0;
}
.cpub-admin-layouts-editor-body > :nth-child(1) { grid-area: canvas; }    /* canvas (1st in DOM) */
.cpub-admin-layouts-editor-body > :nth-child(2) { grid-area: palette; }   /* palette (2nd in DOM) */
.cpub-admin-layouts-editor-body > :nth-child(3) { grid-area: inspector; } /* inspector (3rd in DOM) */

@media (max-width: 1280px) {
  .cpub-admin-layouts-editor-body { grid-template-columns: 240px 1fr 280px; }
}

@media (max-width: 1024px) {
  /* On tablet, fall back to DOM-order single column (canvas first,
     palette next, inspector last) — admin sees the editing surface
     immediately without scrolling past the palette. v1 doesn't ship
     bottom-sheet behavior (Phase 6a). */
  .cpub-admin-layouts-editor-body {
    grid-template-columns: 1fr;
    grid-template-areas: none;
  }
  .cpub-admin-layouts-editor-body > * { grid-area: auto; }
}

/* Phone (<640px) — show a "use a larger screen" banner and HIDE the
   editor body entirely. Drag-drop on 375px is user-hostile per the
   plan §7.7. */
.cpub-admin-layouts-editor-phone-only {
  display: none;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-4);
  text-align: center;
}
.cpub-admin-layouts-editor-phone-only h2 {
  font-size: var(--text-lg);
  margin: 0;
  color: var(--text);
}
.cpub-admin-layouts-editor-phone-only p {
  margin: 0;
  color: var(--text-dim);
  max-width: 32ch;
}
.cpub-admin-layouts-editor-phone-icon {
  font-size: var(--text-3xl);
  color: var(--text-faint);
}
.cpub-admin-layouts-editor-phone-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  color: var(--accent);
  text-decoration: underline;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

@media (max-width: 640px) {
  .cpub-admin-layouts-editor-phone-only { display: flex; }
  .cpub-admin-layouts-editor-body { display: none; }
}
</style>
