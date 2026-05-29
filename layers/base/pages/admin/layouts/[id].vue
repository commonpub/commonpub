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
import { PublishStepError } from '../../../composables/useLayoutEditor';

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin-layouts'],
});

const route = useRoute();
const toast = useToast();
const id = computed<string>(() => String(route.params.id));

const editor = useLayoutEditor(id.value);

// Palette + inspector visibility — persists per-admin via cookie so the
// admin's last layout (e.g. "I always work with inspector hidden, palette
// visible") sticks across sessions. Session 161 user-reported squish fix.
const chrome = useEditorChrome();

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

// R4 audit P1 fix: unsaved-edit guards. Without these, the user can
// navigate (back button, sidebar nav, typed URL) between the last edit
// and the 1500ms debounce firing → silent data loss. visibilitychange
// flush handles Cmd+Tab/minimize but NOT in-app navigation.
//
// Three guards layered for the unique failure modes each covers:
//   1. onBeforeRouteLeave — fires on Nuxt navigation (sidebar links,
//      router.push, NuxtLink). Confirms with the user; if they cancel,
//      navigation aborts and they stay on the editor.
//   2. beforeunload — fires on tab close, reload, or external nav.
//      Modern browsers ignore the message string and show their generic
//      prompt; setting preventDefault is enough to trigger it. Does
//      NOT fire on iOS Safari.
//   3. pagehide → editor.flushBeacon() — session 162 P2.3. The only
//      event that fires reliably on tab-close + bfcache eviction +
//      iOS Safari. Sends the unsaved draft via fetch(keepalive:true)
//      so it survives page teardown when the user closes the tab
//      inside the auto-save debounce window.
function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (editor.dirty.value) {
    e.preventDefault();
    // Some browsers still read returnValue; set for compatibility.
    e.returnValue = '';
  }
}
function onPageHide(): void {
  // Fire-and-forget — the page may be teardowning RIGHT NOW. The
  // beacon's keepalive flag is what makes the request survive.
  editor.flushBeacon();
}
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
  }
});
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('pagehide', onPageHide);
  }
  // R4 P2 (session 161): cancel any in-flight save. Without this, a save
  // started before unmount lands afterward as an "orphan" PUT — which can
  // cause stale 409s the next time the user opens the editor in another
  // tab (server bumped updatedAt; client's cached If-Match is stale).
  editor.abort();
});
onBeforeRouteLeave((_to, _from, next) => {
  if (!editor.dirty.value) return next();
  const ok = window.confirm(
    'You have unsaved changes that haven’t auto-saved yet. Leave anyway?',
  );
  return next(ok);
});

// Auto-save: watches editor.dirty, debounces 1.5s, calls editor.save().
// Composable handles unmount cleanup. Session 162 P2.5: pause when the
// conflict rate exceeds the threshold (3 in 60s) so we stop banging
// the server while the user reconciles with the other editor; the
// banner below surfaces this state with a Resume button.
useLayoutAutoSave({
  dirty: editor.dirty,
  save: () => editor.save(),
  debounceMs: 1500,
  paused: computed(() => editor.conflictThrashing.value),
});

// Surface conflicts from any save (manual or auto) as the modal —
// EXCEPT when we've already crossed into thrashing. At that point the
// banner is the single reconciliation surface; the modal on top would
// be redundant (same actions, more visual noise).
watch(editor.status, (status) => {
  if (status === 'conflict' && !editor.conflictThrashing.value) {
    conflictOpen.value = true;
  }
});

// And: if thrashing trips while the modal is open (the 3rd conflict
// arrives mid-modal), close the modal so the banner is the only surface.
// Focus the banner's safe recommended action AFTER the modal unmounts +
// banner mounts — without this, the previously-focused modal button
// disappears and focus falls back to <body>, stranding keyboard users.
// Only steal focus when the modal WAS open; otherwise the banner's
// role="alert" announces it without disrupting wherever the user was.
const thrashPrimaryBtn = ref<HTMLButtonElement | null>(null);
watch(() => editor.conflictThrashing.value, async (thrashing) => {
  if (!thrashing) return;
  if (!conflictOpen.value) return;
  conflictOpen.value = false;
  await nextTick();
  thrashPrimaryBtn.value?.focus();
});

function onResumeAutoSave(): void {
  editor.clearConflictHistory();
  toast.success('Auto-save resumed');
}

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

function onDiscard(): void {
  // R4 audit P2 fix: surfaces discard() to the UI. Confirms first since
  // discard is destructive (loses unsaved edits).
  if (!editor.dirty.value) return;
  if (!confirm('Discard all unsaved changes? This cannot be undone.')) return;
  editor.discard();
  toast.success('Unsaved changes discarded');
}

async function onPublish(): Promise<void> {
  if (!confirm('Publish this layout? The current draft replaces the live version.')) return;
  try {
    await editor.publish();
    toast.success('Layout published');
  } catch (err) {
    // Session 162 P2.7: surface WHICH step failed so the admin knows
    // whether their changes are safely saved or lost. Generic
    // "Publish failed" hid the save-succeeded-publish-failed case.
    if (err instanceof PublishStepError) {
      const causeMsg = (err.cause as { statusMessage?: string })?.statusMessage;
      switch (err.step) {
        case 'save':
          toast.error(causeMsg
            ? `Could not save your edits (${causeMsg}). Nothing was published.`
            : 'Could not save your edits. Nothing was published.');
          return;
        case 'publish':
          toast.error(
            'Your changes are saved as a draft, but publish failed. ' +
            'Try Publish again — the saved draft is durable.',
          );
          return;
        case 'refresh':
          // The publish succeeded on the server; only the local view
          // is stale. The next save / publish picks up correctly; a
          // reload syncs immediately.
          toast.show(
            'Published — but the editor view is stale. Reload to sync.',
          );
          return;
      }
    }
    const e = err as { statusMessage?: string };
    toast.error(e.statusMessage ?? 'Publish failed');
  }
}

async function onConflictRefresh(): Promise<void> {
  conflictOpen.value = false;
  try {
    await editor.refresh();
    // Refresh = explicit reconciliation (admin took the other version).
    // Clear the throttle so auto-save resumes; if cascade really
    // persists, the rolling-window will trip again on its own.
    editor.clearConflictHistory();
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
    // Force save = explicit reconciliation (admin overwrote with their
    // version). Same rationale as Refresh — resume auto-save.
    editor.clearConflictHistory();
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
        :palette-hidden="chrome.paletteHidden.value"
        :inspector-hidden="chrome.inspectorHidden.value"
        @update:viewport="viewport = $event"
        @save="onSave"
        @publish="onPublish"
        @discard="onDiscard"
        @toggle-palette="chrome.togglePalette"
        @toggle-inspector="chrome.toggleInspector"
      />

      <!--
        Session 162 P2.5: conflict-thrash banner. Shows when 3+ saves
        have 409'd within the last 60s — auto-save is now paused so the
        page stops banging the server while the admin reconciles. The
        existing AdminLayoutsConflictModal handles the per-conflict UX;
        this banner is the layer above, addressing the cascade pattern.
        role="alert" + aria-live="assertive" so screen readers announce
        the pause immediately (it changes the editor's autosave contract).

        Audit fix: the three actions promised in the body copy
        (Refresh / Force save / Resume) all render as inline buttons so
        the admin can reconcile without first triggering a save to surface
        the modal. Reuses the same handlers as the conflict modal.
      -->
      <div
        v-if="editor.conflictThrashing.value"
        class="cpub-admin-layouts-editor-thrash"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <i class="fa-solid fa-triangle-exclamation cpub-admin-layouts-editor-thrash-icon" aria-hidden="true"></i>
        <div class="cpub-admin-layouts-editor-thrash-body">
          <strong>Auto-save paused</strong>
          <span>
            Three of your recent saves collided with another admin's
            edits. Reload their version (recommended) — your edits will
            be lost. Overwriting their changes is destructive and final.
          </span>
        </div>
        <!--
          Button hierarchy matches AdminLayoutsConflictModal verbatim
          (session 160 R1 audit established this discipline): primary
          accent = SAFE recommended action, neutral default = middle
          option, danger red = destructive action LAST in tab order so
          keyboard users don't land on it.
          Banner-specific: "Resume auto-save" replaces the modal's
          "Keep editing here" — same neutral level, different semantic
          (banner's middle option turns auto-save back on without
          reconciliation; modal's middle option closes the modal).
        -->
        <div class="cpub-admin-layouts-editor-thrash-actions">
          <button
            ref="thrashPrimaryBtn"
            type="button"
            class="cpub-admin-layouts-editor-thrash-btn cpub-admin-layouts-editor-thrash-btn--primary"
            @click="onConflictRefresh"
          >
            <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
            Reload their version
          </button>
          <button
            type="button"
            class="cpub-admin-layouts-editor-thrash-btn"
            @click="onResumeAutoSave"
          >
            <i class="fa-solid fa-play" aria-hidden="true"></i>
            Resume auto-save
          </button>
          <button
            type="button"
            class="cpub-admin-layouts-editor-thrash-btn cpub-admin-layouts-editor-thrash-btn--danger"
            @click="onConflictForceSave"
          >
            <i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>
            Overwrite their changes
          </button>
        </div>
      </div>

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

      <div
        class="cpub-admin-layouts-editor-body"
        :class="{
          'cpub-admin-layouts-editor-body--palette-hidden': chrome.paletteHidden.value,
          'cpub-admin-layouts-editor-body--inspector-hidden': chrome.inspectorHidden.value,
        }"
      >
        <!-- Tablet/phone collapse: canvas FIRST so the surface admin came
             for is immediately visible; palette + inspector stack below.
             (Pre-audit ordering put palette first → admin had to scroll
             past 17 tiles to reach the canvas.)
             v-show on palette + inspector (not v-if) preserves component
             state — scroll position, focused field — across hide/show. -->
        <AdminLayoutsCanvas :layout="editor.draft.value" :viewport="viewport" />
        <AdminLayoutsPalette v-show="!chrome.paletteHidden.value" />
        <AdminLayoutsInspector
          v-show="!chrome.inspectorHidden.value"
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

/* Session 162 P2.5 conflict-thrash banner. Audit fix: the original
   --warning token didn't exist in the theme system → fell back to
   surface2 which read as a neutral box, not alert. Now uses the
   established --yellow-bg / --yellow-border tokens (defined on every
   theme — base.css line 70-71 + all variants) that other "attention"
   surfaces in the layer use. Sits between toolbar + body so it's
   visible regardless of canvas scroll. */
.cpub-admin-layouts-editor-thrash {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--yellow-bg);
  color: var(--text);
  border-bottom: var(--border-width-default) solid var(--yellow-border);
  flex-shrink: 0;
}
.cpub-admin-layouts-editor-thrash-icon {
  color: var(--yellow);
  font-size: var(--text-lg);
  flex-shrink: 0;
}
.cpub-admin-layouts-editor-thrash-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.cpub-admin-layouts-editor-thrash-body strong {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}
.cpub-admin-layouts-editor-thrash-body span {
  font-size: var(--text-sm);
  color: var(--text-dim);
}
.cpub-admin-layouts-editor-thrash-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}
.cpub-admin-layouts-editor-thrash-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--surface);
  border: var(--border-width-default) solid var(--border);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  cursor: pointer;
}
.cpub-admin-layouts-editor-thrash-btn:hover { background: var(--surface2); }
.cpub-admin-layouts-editor-thrash-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* Hierarchy matches AdminLayoutsConflictModal's btn--primary +
   btn--danger so the cognitive model for resolving a conflict is the
   same whether the admin meets the modal first or the cascade banner
   first (session 162 audit-on-audit fix). */
.cpub-admin-layouts-editor-thrash-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--surface);
}
.cpub-admin-layouts-editor-thrash-btn--primary:hover { filter: brightness(1.1); background: var(--accent); }
.cpub-admin-layouts-editor-thrash-btn--danger {
  color: var(--red);
  border-color: var(--red);
}
.cpub-admin-layouts-editor-thrash-btn--danger:hover {
  background: var(--red);
  color: var(--surface);
}

@media (max-width: 1024px) {
  /* Wrap the action buttons under the body on tablet/mobile so they
     don't squish the message. */
  .cpub-admin-layouts-editor-thrash {
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .cpub-admin-layouts-editor-thrash-body { flex-basis: 100%; }
  .cpub-admin-layouts-editor-thrash-actions { flex-basis: 100%; justify-content: flex-end; }
}

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

/* Session 161: hide-palette / hide-inspector grid reflow. Removes the
   panel column entirely (vs display:none on the child, which would
   leave the grid column reserved as empty space). v-show on the panel
   element keeps it in the DOM so component state (scroll, focus,
   active field) survives toggling. */
.cpub-admin-layouts-editor-body--palette-hidden {
  grid-template-columns: 1fr 320px;
  grid-template-areas: 'canvas inspector';
}
.cpub-admin-layouts-editor-body--inspector-hidden {
  grid-template-columns: 280px 1fr;
  grid-template-areas: 'palette canvas';
}
.cpub-admin-layouts-editor-body--palette-hidden.cpub-admin-layouts-editor-body--inspector-hidden {
  grid-template-columns: 1fr;
  grid-template-areas: 'canvas';
}

@media (max-width: 1280px) {
  .cpub-admin-layouts-editor-body { grid-template-columns: 240px 1fr 280px; }
  .cpub-admin-layouts-editor-body--palette-hidden { grid-template-columns: 1fr 280px; }
  .cpub-admin-layouts-editor-body--inspector-hidden { grid-template-columns: 240px 1fr; }
  .cpub-admin-layouts-editor-body--palette-hidden.cpub-admin-layouts-editor-body--inspector-hidden { grid-template-columns: 1fr; }
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
