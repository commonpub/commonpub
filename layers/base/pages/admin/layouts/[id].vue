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
import { useLayoutAnnouncer, narrateUndo, narrateRedo, narrateUndoEmpty, narrateRedoEmpty, narrateRowAdded, narrateRowRemoved } from '../../../composables/useLayoutAnnouncer';
import { useLayoutHistory, addRowCommand, removeRowCommand } from '../../../composables/useLayoutHistory';
import { useLayoutHotkeys } from '../../../composables/useLayoutHotkeys';
import { DnDProvider } from '@vue-dnd-kit/core';
import { useSectionRegistry } from '../../../sections/registry';
import { useLayoutResize } from '../../../composables/useLayoutResize';

definePageMeta({
  layout: 'admin',
  middleware: ['auth', 'admin-layouts'],
});

const route = useRoute();
const toast = useToast();
const id = computed<string>(() => String(route.params.id));

const editor = useLayoutEditor(id.value);
const history = useLayoutHistory();

// Phase 3b/B + 3d: window-level keyboard shortcuts. The composable
// attaches on mount + detaches on unmount; input/textarea/contenteditable
// focus skips so the browser's native text editing wins. Phase 3d adds:
//   - Backspace / Delete = remove the selected section
//   - Cmd/Ctrl+D        = duplicate the selected section
//   - ?                 = open the keyboard shortcuts help overlay
const helpOpen = ref<boolean>(false);
const sectionRegistry = useSectionRegistry();

/**
 * Phase 3c — bounds lookup for the Shift+Arrow keyboard resize. Walks
 * the live draft to find the section's host row + its right neighbour,
 * then reads the registry for min/max colSpan. Returning null silences
 * the binding for unresizable / unregistered sections.
 *
 * Lives at the editor page level (vs inside useLayoutHotkeys directly)
 * because the closure needs the LIVE editor.draft + the registry —
 * passing both as closures from setup mirrors the existing
 * `getDraft` / `getSelection` pattern in `useLayoutHotkeys` and
 * keeps the same semantic shape the LayoutRow's
 * `resizeHandlerForSection` already uses.
 */
function lookupResizeBounds(sectionId: string) {
  const draft = editor.draft.value;
  if (!draft) return null;
  // Walk to find host row + index. Inline rather than importing
  // findSectionLocation to keep the search self-contained at the editor
  // page level + return the precise row id.
  for (const zone of draft.zones) {
    for (const row of zone.rows) {
      const idx = row.sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) continue;
      const section = row.sections[idx];
      if (!section) continue;
      const def = sectionRegistry.get(section.type);
      if (!def || !def.resizable) return null;
      const neighbourSection = idx < row.sections.length - 1
        ? row.sections[idx + 1]
        : null;
      const neighbourDef = neighbourSection
        ? sectionRegistry.get(neighbourSection.type)
        : null;
      // Session 166 round-2 audit P1: mirror LayoutRow's
      // resizable:false-neighbour rule. If the neighbour explicitly
      // opted out of resize, treat it as fixed-width (effective min =
      // current colSpan) so the keyboard path can't shrink it either.
      const neighbourFixed = !!neighbourSection && neighbourDef?.resizable === false;
      const effectiveNeighbourMin = neighbourFixed
        ? (neighbourSection?.colSpan ?? 1)
        : (neighbourDef?.minColSpan ?? 1);
      return {
        sectionType: section.type,
        rowId: row.id,
        sectionMin: def.minColSpan,
        sectionMax: def.maxColSpan,
        neighbour: neighbourSection
          ? {
              sectionId: neighbourSection.id,
              min: effectiveNeighbourMin,
              max: neighbourDef?.maxColSpan ?? 12,
            }
          : null,
      };
    }
  }
  return null;
}

useLayoutHotkeys({
  getDraft: () => editor.draft.value,
  getSelection: () => editor.selectedId.value,
  setSelection: (sel) => editor.select(sel),
  onShowHelp: () => { helpOpen.value = true; },
  lookupResizeBounds,
});

// Toolbar undo / redo emit handlers — wire to the same history singleton
// the hotkey uses + the same announcer narration. Tooltip text comes
// from `history.lastLabel` / `nextLabel` so the user can see WHICH
// command they're about to undo without taking action.
function onToolbarUndo(): void {
  const draft = editor.draft.value;
  if (!draft) return;
  const ann = useLayoutAnnouncer();
  const cmd = history.undo(draft);
  ann.announcePolite(cmd ? narrateUndo(cmd.label) : narrateUndoEmpty());
}
function onToolbarRedo(): void {
  const draft = editor.draft.value;
  if (!draft) return;
  const ann = useLayoutAnnouncer();
  const cmd = history.redo(draft);
  ann.announcePolite(cmd ? narrateRedo(cmd.label) : narrateRedoEmpty());
}

/**
 * Session 164 polish — "+ Add row" handler. Closes the v1 blocker
 * where a fresh layout (or one with an empty zone) had no drop target.
 *
 * Mutates draft directly so the existing dirty watcher fires +
 * auto-save schedules. Records to history so Cmd+Z removes the row
 * (the addRowCommand's invert handles this). Narrates via assertive
 * channel — "Row added" is a state change like drag/drop, not
 * informational like undo.
 */
function onAddRow(zoneSlug: string): void {
  const draft = editor.draft.value;
  if (!draft) return;
  const zone = draft.zones.find((z) => z.zone === zoneSlug);
  if (!zone) return;
  const newRow = {
    id: crypto.randomUUID(),
    order: zone.rows.length,
    config: null,
    sections: [],
  };
  const position = zone.rows.length;
  zone.rows.push(newRow);
  const ann = useLayoutAnnouncer();
  ann.announce(narrateRowAdded(zoneSlug, position, zone.rows.length));
  history.record(addRowCommand({
    zoneSlug,
    position,
    row: newRow,
    label: `add row to ${zoneSlug}`,
  }));
}

/**
 * Session 164 polish — Remove row. Confirm before removing rows with
 * sections (destructive intent: section data goes away, only restorable
 * via Cmd+Z within the same editor session). Empty rows skip confirm —
 * they were the Add Row button's leftover dashed placeholder; removing
 * is a recovery action, not a destruction.
 */
function onRemoveRow(zoneSlug: string, rowId: string): void {
  const draft = editor.draft.value;
  if (!draft) return;
  const zone = draft.zones.find((z) => z.zone === zoneSlug);
  if (!zone) return;
  const idx = zone.rows.findIndex((r) => r.id === rowId);
  if (idx === -1) return;
  const row = zone.rows[idx];
  if (!row) return;
  if (row.sections.length > 0) {
    const sectionWord = row.sections.length === 1 ? 'section' : 'sections';
    const ok = window.confirm(
      `Remove this row and its ${row.sections.length} ${sectionWord}? `
      + `Cmd+Z restores it within this session.`,
    );
    if (!ok) return;
  }
  const position = idx;
  // Capture the row's full state BEFORE splice so the command's invert
  // can restore sections + config too.
  const rowClone = JSON.parse(JSON.stringify(row));
  zone.rows.splice(idx, 1);
  const ann = useLayoutAnnouncer();
  ann.announce(narrateRowRemoved(zoneSlug));
  history.record(removeRowCommand({
    zoneSlug,
    position,
    row: rowClone,
    label: `remove row from ${zoneSlug}`,
  }));
  // Clear selection if the removed row contained the currently-selected
  // section/row (it's no longer in draft).
  const sel = editor.selectedId.value;
  if (sel) {
    if (sel.kind === 'row' && sel.id === rowId) editor.clearSelection();
    else if (sel.kind === 'section' && rowClone.sections.some((s: { id: string }) => s.id === sel.id)) {
      editor.clearSelection();
    }
  }
}

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

// Phase 3b/B: clear undo history at seed time. The history singleton is
// module-scoped, so opening a different layout could otherwise inherit
// the previous editor's stack — Cmd+Z would undo into the wrong draft.
// Same rule applies on refresh + save success (handled below via watch).
history.clear();

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
  // Session 163 deep audit: useLayoutAnnouncer is a module-scope
  // singleton with a 1.2s auto-clear setTimeout. Without explicit
  // clear() on unmount, the message + pending timer leak across editor
  // mounts — closing layout A while a Move announcement is mid-cycle
  // would show that stale message on the next editor open. Two agents
  // independently caught this (Agent A + Agent B).
  useLayoutAnnouncer().clear();
  // Session 166 R3-6 audit: useLayoutResize is also a module-scope
  // singleton. If the user navigates away mid-drag (e.g. unsaved-edit
  // guard accepts), the resize state stays 'resizing' across editor
  // mounts. The composable's defensive recovery in startResize would
  // commit-and-replace, but until then the state is stale + the
  // document handlers are still attached. Explicit cancel matches the
  // announcer pattern + closes the leak fully.
  useLayoutResize().cancelResize();
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
//
// Session 165 round 5 — dual-modal coordination: if the user has the
// keyboard-shortcuts help overlay open and a 409 fires (e.g. auto-save
// debounce landed on a conflict mid-read), close help so the conflict
// resolution dialog owns focus exclusively. Both modals have focus
// traps; without this, the briefly-overlapping mount window would
// ping-pong focus between them. The topmost-only guard inside each
// modal's trap covers the brief mount window; this closes the window
// fully by making the lower modal go away.
watch(editor.status, (status) => {
  if (status === 'conflict' && !editor.conflictThrashing.value) {
    conflictOpen.value = true;
    helpOpen.value = false;
  }
});

/*
 * Phase 3b/B + R2 audit P1 fix: history clears when the SERVER baseline
 * changes (refresh, save success) AND the local draft matches that
 * baseline (dirty=false). One watcher, one gate.
 *
 * Why dirty-gated: the original status-transition approach cleared on
 * every saving→saved transition, but that's wrong when the user undid
 * MID-SAVE. Concretely: save kicks off at t=1500ms; user undos at
 * t=1800ms; save completes at t=2200ms (with the pre-undo snapshot
 * persisted). After save: original = pre-undo state; draft = post-undo
 * state; dirty = TRUE. Clearing history here would nuke the redo branch
 * for an undo that hasn't actually been persisted yet. The dirty gate
 * ensures we only clear when the LOCAL state ALSO matches the server.
 *
 * Why one watcher instead of two: save() reassigns original AND
 * transitions status; refresh() reassigns original AND resets status to
 * 'idle'. Both flow through the original-change. The previous dual-
 * watcher setup fired clear() twice on save (idempotent but indicates
 * architectural confusion).
 *
 * discard() doesn't change original (just draft); its explicit
 * history.clear() call in onDiscard covers that path.
 */
watch(() => editor.original.value, (newOriginal, oldOriginal) => {
  if (oldOriginal === null) return; // initial seed; handled at await time
  if (newOriginal === oldOriginal) return;
  // The server baseline changed. If the local draft has un-saved edits
  // on top of it, keep history so the user can still undo them. If
  // draft is in lockstep with original, clear (saved baseline is the
  // new ground truth per plan §7.14).
  if (!editor.dirty.value) {
    history.clear();
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

/**
 * Phase 3e — section/row config edits from the inspector. Locate the
 * target by id in the live draft + replace its `config` object. The deep
 * `draft` watcher fires → `dirty` flips → the existing 1.5s auto-save
 * debounce persists (single-flight save untouched). Config edits are not
 * yet recorded to the undo stack — plan §7.14's `edit-section-config` op
 * is a follow-up (Phase 3f); page-meta edits have the same gap today.
 */
function onSectionConfigUpdate(payload: { id: string; config: Record<string, unknown> }): void {
  const draft = editor.draft.value;
  if (!draft) return;
  for (const zone of draft.zones) {
    for (const row of zone.rows) {
      const section = row.sections.find((s) => s.id === payload.id);
      if (section) {
        section.config = payload.config;
        return;
      }
    }
  }
}
function onRowConfigUpdate(payload: { id: string; config: Record<string, unknown> }): void {
  const draft = editor.draft.value;
  if (!draft) return;
  for (const zone of draft.zones) {
    const row = zone.rows.find((r) => r.id === payload.id);
    if (row) {
      row.config = payload.config;
      return;
    }
  }
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
  // Phase 3b/B: discard replaces `draft` with a clone of `original`. The
  // commands in the past stack reference sections + positions that may
  // not exist in the discarded-from state; an undo would re-apply
  // operations that "discard" effectively rolled back. The confirm
  // dialog already warned this is destructive — undo across discard
  // would be more surprising, not less. So clear.
  history.clear();
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
        :can-undo="history.canUndo.value"
        :can-redo="history.canRedo.value"
        :undo-label="history.lastLabel.value"
        :redo-label="history.nextLabel.value"
        @update:viewport="viewport = $event"
        @save="onSave"
        @publish="onPublish"
        @discard="onDiscard"
        @undo="onToolbarUndo"
        @redo="onToolbarRedo"
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
        Round-3 audit fix: phone (≤640px) sees a single banner instead
        of the editor. Drag-drop on a 375px viewport is user-hostile
        regardless of how well-designed — matches docs/plans/layout-and-pages.md §7.7.
        Note: the @media rule uses `max-width: 640px` (inclusive), so
        a viewport at exactly 640px sees the banner — comment matches.
      -->
      <div class="cpub-admin-layouts-editor-phone-only">
        <i class="fa-solid fa-display cpub-admin-layouts-editor-phone-icon" aria-hidden="true"></i>
        <h2>Use a larger screen</h2>
        <p>The layout editor needs a tablet or desktop viewport (640px or wider).</p>
        <NuxtLink to="/admin/layouts" class="cpub-admin-layouts-editor-phone-back">← Back to Layouts</NuxtLink>
      </div>

      <!--
        Phase 3b/A: DnDProvider is the drag-drop root. ONE provider per
        editor; ALL draggables (palette tiles) + droppables (rows / zones)
        must be inside this subtree so dnd-kit's collision detection +
        keyboard sensor can see them as a single namespace.
        Wraps palette + canvas + inspector together so drag-from-palette
        → drop-on-canvas works without crossing a provider boundary.
        Per the package's external API verified at session 162 close:
        - keyboard sensor auto-attaches to document on mount (Space/Arrow/Esc)
        - `previewTo='body'` teleports the drag preview to <body> so it
          escapes any overflow:hidden ancestor + stays above the chrome
        Click-outside the body clears selection (the inspector then
        falls back to the page-meta form per §7.9 dispatch pattern).
      -->
      <!--
        Phase 3b/A: SR narration channel — a singleton aria-live region
        that <LayoutSection> + <LayoutRow> mirror drag/drop + Move
        Up/Down events into. dnd-kit ships no announcer OOTB; this
        closes the WCAG 2.1.1 gap. Mounted ONCE outside the
        DnDProvider so it survives the inner reactivity churn.
      -->
      <AdminLayoutsAnnouncer />

      <DnDProvider
        preview-to="body"
        class="cpub-admin-layouts-editor-dnd"
        @click.self="editor.clearSelection"
      >
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
          <AdminLayoutsCanvas
            :layout="editor.draft.value"
            :viewport="viewport"
            :on-select="editor.select"
            :selected-id="editor.selectedId.value"
            :on-add-row="onAddRow"
            :on-remove-row="onRemoveRow"
          />
          <AdminLayoutsPalette v-show="!chrome.paletteHidden.value" />
          <AdminLayoutsInspector
            v-show="!chrome.inspectorHidden.value"
            :draft="editor.draft.value"
            :selection="editor.selectedId.value"
            @update:page-meta="onPageMetaUpdate"
            @update:name="onNameUpdate"
            @update:section-config="onSectionConfigUpdate"
            @update:row-config="onRowConfigUpdate"
          />

          <!--
            Session 164 polish: edge tab toggles for palette + inspector.
            Move-on-collapse pattern (Notion / Linear / Cursor): when the
            panel is visible the tab sits at the panel's outer edge; when
            the panel is collapsed the tab sits at the screen edge,
            inviting expansion. The chevron icon tells the direction.

            Placed INSIDE editor-body (which is position:relative) so
            absolute positioning anchors to it. v-show on the panels
            preserves their state across toggles; the tabs themselves
            are always visible in editable mode.

            Hidden on mobile/tablet (< 1024px) where the body falls
            back to a single column DOM-order stack — the toggles
            would float over content with no panel to collapse.
          -->
          <button
            type="button"
            class="cpub-admin-layouts-editor-edge-tab cpub-admin-layouts-editor-edge-tab--left"
            :class="{ 'cpub-admin-layouts-editor-edge-tab--collapsed': chrome.paletteHidden.value }"
            :aria-label="chrome.paletteHidden.value ? 'Show sections panel' : 'Hide sections panel'"
            :aria-pressed="!chrome.paletteHidden.value"
            :title="chrome.paletteHidden.value ? 'Show sections panel' : 'Hide sections panel'"
            @click="chrome.togglePalette"
          >
            <i :class="chrome.paletteHidden.value ? 'fa-solid fa-angles-right' : 'fa-solid fa-angles-left'" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="cpub-admin-layouts-editor-edge-tab cpub-admin-layouts-editor-edge-tab--right"
            :class="{ 'cpub-admin-layouts-editor-edge-tab--collapsed': chrome.inspectorHidden.value }"
            :aria-label="chrome.inspectorHidden.value ? 'Show inspector panel' : 'Hide inspector panel'"
            :aria-pressed="!chrome.inspectorHidden.value"
            :title="chrome.inspectorHidden.value ? 'Show inspector panel' : 'Hide inspector panel'"
            @click="chrome.toggleInspector"
          >
            <i :class="chrome.inspectorHidden.value ? 'fa-solid fa-angles-left' : 'fa-solid fa-angles-right'" aria-hidden="true"></i>
          </button>
        </div>
      </DnDProvider>

      <AdminLayoutsConflictModal
        :open="conflictOpen"
        :message="editor.errorMessage.value"
        @refresh="onConflictRefresh"
        @force-save="onConflictForceSave"
        @close="conflictOpen = false"
      />
      <!-- Phase 3d.3 — keyboard shortcut help overlay. Opens on `?`
           via useLayoutHotkeys.onShowHelp; Esc / backdrop click / Close
           button dismiss. Read-only; no editor state mutation. -->
      <AdminLayoutsHelpOverlay
        :open="helpOpen"
        @close="helpOpen = false"
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

/* Phase 3b/A — DnDProvider sits between the editor wrapper and the
   body grid. Without explicit dimensions it would collapse and the
   body grid loses its height. Mirrors the body's flex behavior so
   the provider is layout-transparent. */
.cpub-admin-layouts-editor-dnd {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.cpub-admin-layouts-editor-dnd > .cpub-admin-layouts-editor-body {
  flex: 1;
  min-height: 0;
}

.cpub-admin-layouts-editor-body {
  display: grid;
  /* DOM order: canvas, palette, inspector. CSS grid-template-areas
     places them visually palette / canvas / inspector at >=1024px. */
  grid-template-columns: 280px 1fr 320px;
  grid-template-areas: 'palette canvas inspector';
  flex: 1;
  min-height: 0;
  /* Session 164: positions the edge-tab toggles anchored to the body's
     left/right boundaries. The tabs use absolute positioning relative
     to this container. */
  position: relative;
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

/* ------------------------------------------------------------------ */
/* Session 164 polish: panel edge-tab toggles.                          */
/*                                                                      */
/* Replaces the toolbar palette/inspector buttons (user-reported as     */
/* non-obvious). Tabs sit at the panel/canvas boundary when the panel  */
/* is visible, and AT the screen edge when the panel is collapsed —    */
/* the icon (« / ») tells the direction.                                */
/*                                                                      */
/* 280px on the left aligns to palette's grid column width; 320px on   */
/* the right aligns to inspector's. The --collapsed modifier moves the */
/* tab to the screen edge (left:0 or right:0).                          */
/*                                                                      */
/* Hidden on <1024px viewport: at tablet/phone the body falls back to a */
/* DOM-order single column stack; floating edge tabs would overlay the  */
/* stacked panels meaninglessly.                                        */
/* ------------------------------------------------------------------ */
.cpub-admin-layouts-editor-edge-tab {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  /* Session 164 audit R1-1: bumped from 18px → 28px to clear WCAG 2.5.8
     AA minimum target size (24×24) with a small design buffer.
     Matches the 28×28 button convention used for cpub-layout-section-move
     per feedback-visual-editor-ux-patterns. Height stays at 56px (2× width)
     so the tab still reads as a vertical edge handle, not a square button. */
  width: 28px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  /* Above the canvas + panel content but below modals + announcer */
  z-index: 5;
  transition: left 200ms ease-out, right 200ms ease-out, background var(--transition-default), color var(--transition-default);
  /* Compact icon size matches the slim handle silhouette. The 28px
     touch surface is what WCAG cares about — the chevron centers inside. */
  font-size: 10px;
}
.cpub-admin-layouts-editor-edge-tab:hover {
  background: var(--surface2);
  color: var(--accent);
  border-color: var(--accent);
}
.cpub-admin-layouts-editor-edge-tab:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  color: var(--accent);
}

.cpub-admin-layouts-editor-edge-tab--left {
  /* Sit at the right edge of the palette (which is 280px wide). The
     -14px offset centers the 28px-wide tab ON the boundary so half is
     in the palette + half in the canvas — reads as "the boundary
     itself is the toggle". (Was -9px when the tab was 18px wide.) */
  left: calc(280px - 14px);
}
.cpub-admin-layouts-editor-edge-tab--right {
  right: calc(320px - 14px);
}
.cpub-admin-layouts-editor-edge-tab--left.cpub-admin-layouts-editor-edge-tab--collapsed {
  /* Collapsed: snap to the screen edge so the admin sees an obvious
     "click here to bring it back" affordance. */
  left: 0;
}
.cpub-admin-layouts-editor-edge-tab--right.cpub-admin-layouts-editor-edge-tab--collapsed {
  right: 0;
}

/* Mirror the breakpoint reduction at <=1280px so the tabs follow the
   narrower panel widths (240 / 280 from the body media query). The
   -14px offset is the 28px-wide tab's half-width, same logic as the
   1025px+ case above (was -9px when the tab was 18px wide). */
@media (max-width: 1280px) {
  .cpub-admin-layouts-editor-edge-tab--left { left: calc(240px - 14px); }
  .cpub-admin-layouts-editor-edge-tab--right { right: calc(280px - 14px); }
  .cpub-admin-layouts-editor-edge-tab--left.cpub-admin-layouts-editor-edge-tab--collapsed { left: 0; }
  .cpub-admin-layouts-editor-edge-tab--right.cpub-admin-layouts-editor-edge-tab--collapsed { right: 0; }
}

/* Tablet/phone: hide. The single-column DOM stack already gives admin
   direct access to each section without needing collapse affordances. */
@media (max-width: 1024px) {
  .cpub-admin-layouts-editor-edge-tab { display: none; }
  /* Session 164 audit R3-3: force panels visible regardless of the
     cookie-persisted desktop-collapse state. At tablet/phone the body
     falls back to a DOM-order single-column stack — the desktop
     'collapsed' state has no useful meaning when there's no grid column
     to remove, but `chrome.paletteHidden` / `chrome.inspectorHidden`
     still drive v-show on the panel components, leaving an admin who
     collapsed on desktop with NO way to re-show on tablet (the edge
     tabs are hidden by the rule above; the toolbar toggles were
     removed in the 164 polish). Override v-show's inline display:none
     with `flex !important` (panels natively use display:flex column —
     'block' would break their internal layout). Scoped :deep() because
     the .cpub-admin-layouts-{palette,inspector} root classes live in
     child components. */
  :deep(.cpub-admin-layouts-palette),
  :deep(.cpub-admin-layouts-inspector) {
    display: flex !important;
  }
}

/* prefers-reduced-motion: kill the slide transition so the tab snaps
   to its new position immediately. Plan §7.11 + WCAG 2.3.3. */
@media (prefers-reduced-motion: reduce) {
  .cpub-admin-layouts-editor-edge-tab { transition: none; }
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
