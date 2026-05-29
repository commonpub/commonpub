/**
 * useLayoutHotkeys — keyboard shortcuts for the layout editor.
 *
 * Phase 3b/B (3b.8): Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo.
 * Phase 3d.1: Backspace / Delete = remove the selected section.
 * Phase 3d.2: Cmd/Ctrl+D = duplicate the selected section.
 * Phase 3d.3: ? (Shift+/) = show the help overlay.
 *
 * Deliberate non-binding: Cmd/Ctrl+Y. Notion, Linear, Figma, VS Code,
 * Google Docs all settled on Shift+Z for redo on Mac (where Cmd+Y is
 * "Show History"). Windows users may still expect Ctrl+Y, but matching
 * the modern editor convention (Shift+Z BOTH places) is what the
 * `feedback-match-established-pattern` memory points at.
 *
 * Input-field skip: when the focused element is `input`, `textarea`,
 * or `[contenteditable]`, the browser's native undo handles per-field
 * text undo + plain typing (so `?` in a search field stays a `?`).
 * Stealing those keystrokes for layout commands would be user-hostile.
 * We check `e.target` and short-circuit on every binding.
 *
 * SSR: the `typeof window` guard prevents the addEventListener call
 * on server-render. Per `feedback-vitest-import-meta-client-undefined`
 * — `import.meta.client` is a Nuxt build-time replacement that doesn't
 * exist in vitest; `typeof window` is portable.
 *
 * Lifecycle: caller invokes inside `<script setup>` (the editor page);
 * we attach on mount + detach on unmount via the lifecycle hooks. The
 * editor unmount also clears history elsewhere — these are independent
 * cleanups; both must happen.
 */
import { onBeforeUnmount, onMounted } from 'vue';
import type { LayoutRecord } from '@commonpub/server';
import type { LayoutSection } from './useLayout';
import type { EditorSelection } from './useLayoutEditor';
import {
  useLayoutHistory,
  removeSectionCommand,
  duplicateSectionCommand,
  findSectionLocation,
} from './useLayoutHistory';
import {
  useLayoutAnnouncer,
  narrateUndo,
  narrateRedo,
  narrateUndoEmpty,
  narrateRedoEmpty,
  narrateSectionRemoved,
  narrateSectionDuplicated,
} from './useLayoutAnnouncer';

export interface UseLayoutHotkeysOptions {
  /** Read the live draft at hotkey-time. Closure so the hotkey handler
   *  always sees the current draft even after refresh/discard reassigns
   *  the ref. Returns null when no draft is loaded; the hotkey is a
   *  silent noop then. */
  getDraft: () => LayoutRecord | null;
  /** Read the current selection at hotkey-time. Optional so the existing
   *  Cmd+Z/Cmd+Shift+Z bindings continue to work in tests + call sites
   *  that don't care about selection. Returns null when nothing selected;
   *  selection-gated hotkeys (Backspace, Cmd+D) become silent noops. */
  getSelection?: () => EditorSelection;
  /** Mutate selection. Backspace removes the section + clears selection
   *  (the section is gone). Cmd+D moves selection to the clone so the
   *  user can immediately Cmd+D again or arrow-move it. Optional so the
   *  composable degrades gracefully when not provided. */
  setSelection?: (sel: EditorSelection) => void;
  /** Toggled by `?` (Shift+/). The editor page mounts the help overlay
   *  modal + binds its `open` state to this callback. Optional — when
   *  absent, `?` is a silent noop. */
  onShowHelp?: () => void;
}

export interface UseLayoutHotkeysResult {
  /** Detach the handler imperatively (tests, or manual pause). The
   *  default lifecycle hook also detaches on unmount. */
  detach: () => void;
}

/** Is the event's target a text-input surface that owns its own undo
 *  + native typing semantics? */
function isTextInputTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  if (typeof el.matches !== 'function') return false;
  // `[contenteditable]` matches both `contenteditable` and
  // `contenteditable="true"`; `[contenteditable="false"]` would be a
  // read-only block, so it's safe to skip via plain attr presence.
  return el.matches('input, textarea, [contenteditable]:not([contenteditable="false"])');
}

/** Cmd on Mac, Ctrl elsewhere. We test BOTH so a user on Mac who
 *  remapped Ctrl→Cmd still gets the binding. */
function isUndoLike(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z');
}

/** Backspace OR Delete with no modifiers. macOS sends 'Backspace' for the
 *  big delete key + 'Delete' for fn+Backspace; Windows sends 'Delete' for
 *  the standalone Del key. Both should fire the same intent — "remove
 *  the selected thing". Modifier-free so Cmd+Backspace (URL clear in
 *  Safari) stays user-controlled. */
function isRemoveLike(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return e.key === 'Backspace' || e.key === 'Delete';
}

/** Cmd/Ctrl+D — duplicate. Shift modifier explicitly excluded so
 *  Cmd+Shift+D (often "duplicate WITHOUT formatting" in editors,
 *  unbound here) doesn't accidentally fire. Browsers bind Cmd+D to
 *  "add bookmark" — we preventDefault when we handle, otherwise the
 *  user can still bookmark. */
function isDuplicateLike(e: KeyboardEvent): boolean {
  if (e.shiftKey || e.altKey) return false;
  if (!(e.metaKey || e.ctrlKey)) return false;
  return e.key === 'd' || e.key === 'D';
}

/** `?` (Shift+/ on US keyboards). Cross-keyboard portable because we
 *  test the produced character, not the physical key. `key === '?'`
 *  fires for any layout that produces a literal question mark. */
function isHelpLike(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  return e.key === '?';
}

/**
 * Should removing a section require a confirm? Heuristic: any
 * authored config makes the section "rich" — the keystroke could
 * destroy real authored content. An empty config (defaults only)
 * is the just-dragged-in placeholder; removing it is recovery, not
 * destruction. Mirrors `onRemoveRow`'s "confirm only when there's
 * content" pattern in the editor page.
 *
 * Cmd+Z restores either way (within the session), so the confirm is
 * a soft guard, not a contract. We still bypass when the section
 * has no config — the keystroke is fast, the undo is fast, and the
 * confirm dialog interrupts an empty-section sweep flow.
 */
function isRichSection(section: LayoutSection): boolean {
  const cfg = section.config;
  if (!cfg || typeof cfg !== 'object') return false;
  return Object.keys(cfg).length > 0;
}

export function useLayoutHotkeys(opts: UseLayoutHotkeysOptions): UseLayoutHotkeysResult {
  const history = useLayoutHistory();
  const announcer = useLayoutAnnouncer();
  let attached = false;

  function onKeyDown(e: KeyboardEvent): void {
    if (isTextInputTarget(e.target)) return; // text fields own the keystroke

    // --- Undo / Redo (Phase 3b/B) ---
    if (isUndoLike(e)) {
      const draft = opts.getDraft();
      if (!draft) return;
      // Shift modifier reverses direction. Order matters: check Shift
      // FIRST so Cmd+Shift+Z doesn't fall into the undo branch.
      if (e.shiftKey) {
        const cmd = history.redo(draft);
        e.preventDefault();
        announcer.announcePolite(cmd ? narrateRedo(cmd.label) : narrateRedoEmpty());
        return;
      }
      const cmd = history.undo(draft);
      e.preventDefault();
      announcer.announcePolite(cmd ? narrateUndo(cmd.label) : narrateUndoEmpty());
      return;
    }

    // --- Help overlay (Phase 3d.3) ---
    if (isHelpLike(e)) {
      if (!opts.onShowHelp) return;
      e.preventDefault();
      opts.onShowHelp();
      return;
    }

    // The remaining bindings (Backspace, Cmd+D) require a section
    // selection. Read once + short-circuit if not applicable.
    const sel = opts.getSelection?.();
    if (!sel || sel.kind !== 'section') return;
    const draft = opts.getDraft();
    if (!draft) return;
    const loc = findSectionLocation(draft, sel.id);
    if (!loc) return; // stale selection — section vanished mid-keydown

    // --- Remove (Phase 3d.1) ---
    if (isRemoveLike(e)) {
      e.preventDefault();
      // Soft confirm only when there's authored content. Empty sections
      // (just-dropped placeholders) skip — the keystroke + Cmd+Z roundtrip
      // is faster than a confirm dialog for the sweep case.
      if (isRichSection(loc.section)) {
        // typeof guard so SSR / jsdom-without-window doesn't blow up.
        const confirmFn = typeof window !== 'undefined' ? window.confirm : () => true;
        const ok = confirmFn(
          `Remove this ${loc.section.type} section? Press Command+Z within this session to restore it.`,
        );
        if (!ok) return;
      }
      // Capture position BEFORE splice so the command's invert can
      // restore at the original index (clamped by the factory).
      const sectionClone = JSON.parse(JSON.stringify(loc.section)) as LayoutSection;
      loc.row.sections.splice(loc.idx, 1);
      announcer.announce(narrateSectionRemoved(loc.section.type, loc.zoneSlug));
      history.record(removeSectionCommand({
        rowId: loc.row.id,
        position: loc.idx,
        section: sectionClone,
        label: `remove ${loc.section.type}`,
      }));
      // Selection points at a section that's no longer in the draft —
      // clear it so the inspector falls back to page-meta + keyboard
      // focus follows along when the page re-renders.
      opts.setSelection?.(null);
      return;
    }

    // --- Duplicate (Phase 3d.2) ---
    if (isDuplicateLike(e)) {
      e.preventDefault();
      // Mint a fresh id BEFORE building the command so apply + invert
      // both reference the same instance across undo/redo cycles. Using
      // crypto.randomUUID() so the id is globally unique (collision
      // resistance: 122 bits of entropy >> v1 layout sizes).
      const cloneId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${loc.section.id}-copy-${Date.now()}`;
      const clone: LayoutSection = {
        ...JSON.parse(JSON.stringify(loc.section)),
        id: cloneId,
      };
      // Land directly after the source so the visual + ordering both
      // match "duplicate" semantics. (Notion / Figma / Linear all
      // converge on insert-after-source.)
      const at = loc.idx + 1;
      loc.row.sections.splice(at, 0, JSON.parse(JSON.stringify(clone)));
      announcer.announce(narrateSectionDuplicated(loc.section.type, at, loc.row.sections.length));
      history.record(duplicateSectionCommand({
        rowId: loc.row.id,
        at,
        clone,
        label: `duplicate ${loc.section.type}`,
      }));
      // Move selection to the clone so a second Cmd+D duplicates the
      // duplicate (not the original) — matches Figma + Notion sequence
      // semantics. Arrow keys / Move Up now operate on the new copy.
      opts.setSelection?.({ kind: 'section', id: cloneId });
      return;
    }
  }

  function detach(): void {
    if (!attached) return;
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', onKeyDown);
    attached = false;
  }

  onMounted(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', onKeyDown);
    attached = true;
  });

  onBeforeUnmount(() => {
    detach();
  });

  return { detach };
}
