/**
 * useLayoutHotkeys — keyboard shortcuts for the layout editor.
 *
 * Phase 3b/B (3b.8). Today's surface area:
 *   - Cmd/Ctrl+Z         → undo
 *   - Cmd/Ctrl+Shift+Z   → redo
 *
 * Deliberate non-binding: Cmd/Ctrl+Y. Notion, Linear, Figma, VS Code,
 * Google Docs all settled on Shift+Z for redo on Mac (where Cmd+Y is
 * "Show History"). Windows users may still expect Ctrl+Y, but matching
 * the modern editor convention (Shift+Z BOTH places) is what the
 * `feedback-match-established-pattern` memory points at.
 *
 * Input-field skip: when the focused element is `input`, `textarea`,
 * or `[contenteditable]`, the browser's native undo handles per-field
 * text undo. Stealing Cmd+Z for layout undo would wipe their typing
 * — user-hostile. We check `e.target` and short-circuit.
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
import { useLayoutHistory } from './useLayoutHistory';
import {
  useLayoutAnnouncer,
  narrateUndo,
  narrateRedo,
  narrateUndoEmpty,
  narrateRedoEmpty,
} from './useLayoutAnnouncer';

export interface UseLayoutHotkeysOptions {
  /** Read the live draft at hotkey-time. Closure so the hotkey handler
   *  always sees the current draft even after refresh/discard reassigns
   *  the ref. Returns null when no draft is loaded; the hotkey is a
   *  silent noop then. */
  getDraft: () => LayoutRecord | null;
}

export interface UseLayoutHotkeysResult {
  /** Detach the handler imperatively (tests, or manual pause). The
   *  default lifecycle hook also detaches on unmount. */
  detach: () => void;
}

/** Is the event's target a text-input surface that owns its own undo? */
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

export function useLayoutHotkeys(opts: UseLayoutHotkeysOptions): UseLayoutHotkeysResult {
  const history = useLayoutHistory();
  const announcer = useLayoutAnnouncer();
  let attached = false;

  function onKeyDown(e: KeyboardEvent): void {
    if (!isUndoLike(e)) return;
    if (isTextInputTarget(e.target)) return; // browser native undo wins

    const draft = opts.getDraft();
    if (!draft) {
      // No draft loaded — silently ignore. Don't preventDefault either:
      // the user may have a different undo target on the page (Nuxt
      // devtools, etc).
      return;
    }

    // Shift modifier reverses direction. Order matters: check Shift
    // FIRST so Cmd+Shift+Z doesn't fall into the undo branch.
    if (e.shiftKey) {
      const cmd = history.redo(draft);
      // Always preventDefault on a matched hotkey so the browser's
      // own redo (rare on this combo) doesn't double-fire.
      e.preventDefault();
      announcer.announcePolite(cmd ? narrateRedo(cmd.label) : narrateRedoEmpty());
      return;
    }

    const cmd = history.undo(draft);
    e.preventDefault();
    announcer.announcePolite(cmd ? narrateUndo(cmd.label) : narrateUndoEmpty());
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
