/**
 * useLayoutAnnouncer — singleton screen-reader narration channel for
 * the layout editor's drag/drop + Move Up/Down operations.
 *
 * Phase 3b/A. The @vue-dnd-kit/core package ships NO ARIA live region
 * out of the box (verified at session 162 close — grep of the package
 * source returned no `aria-live` / `role="status"` rules); WCAG 2.1.1
 * Level A requires drag-drop to be reachable + narrated for keyboard +
 * screen-reader users. This composable + its <AdminLayoutsAnnouncer>
 * companion close that gap.
 *
 * Singleton design: a module-level ref. Every `useLayoutAnnouncer()`
 * call gets the same `message` ref + the same `announce()` function.
 * <LayoutSection> and <LayoutRow> call `announce()` on drag/drop
 * events; the <AdminLayoutsAnnouncer> component reads `message` and
 * mirrors it into a `role="status" aria-live="assertive"` div.
 *
 * Why a singleton (vs provide/inject)? The composable is consumed in
 * deep children of the editor page; provide/inject would require
 * provider plumbing across every component tree. A module-scoped ref
 * has the same effective lifetime (the editor page mounts → unmounts;
 * the next editor mount resets via clearAnnouncement). Mirrors how
 * `useTheme` + `useEditorChrome` are written elsewhere in the layer.
 *
 * Narration discipline (per feedback-visual-editor-ux-patterns):
 *  - position-based ('moved to position 3 of 5'), NEVER index-based
 *    ('moved to index 2'). Users count from 1; arrays count from 0.
 *  - `assertive` not `polite` for drag pickup + drop (the user needs
 *    to know NOW, otherwise the next arrow press lands silently).
 *  - announce on END not START to avoid double-narration when the
 *    user picks up + immediately drops in the same place.
 *  - clear the message after a short delay so the live region doesn't
 *    re-announce on re-focus or reflow (screen readers don't repeat
 *    unchanged content, but explicit clearing is more robust).
 */
import { ref, type Ref } from 'vue';

const message = ref<string>('');

/** Auto-clear handle so a stale message doesn't linger for the next
 *  drag's announcement (when the new message would be identical to
 *  the lingering one, some screen readers don't re-announce). */
let clearHandle: ReturnType<typeof setTimeout> | null = null;
const CLEAR_AFTER_MS = 1200;

function scheduleClear(): void {
  if (typeof window === 'undefined') return;
  if (clearHandle !== null) clearTimeout(clearHandle);
  clearHandle = setTimeout(() => {
    message.value = '';
    clearHandle = null;
  }, CLEAR_AFTER_MS);
}

export interface LayoutAnnouncer {
  /** The current narration text — bound to the announcer component's
   *  aria-live region's text content. */
  message: Ref<string>;
  /** Set the current message + schedule an auto-clear. Calling
   *  announce() twice in quick succession REPLACES the previous
   *  message (last-write-wins) — the user only cares about the
   *  most-recent state. */
  announce: (text: string) => void;
  /** Immediately clear. Called on editor unmount to prevent the
   *  message lingering into the next page. */
  clear: () => void;
}

export function useLayoutAnnouncer(): LayoutAnnouncer {
  function announce(text: string): void {
    // Same-text re-announcement: nudge by setting to empty first so
    // screen readers DO re-announce (some skip otherwise). Done in a
    // micro-task so Vue batches the empty + final assignment into one
    // reactive update.
    if (message.value === text) {
      message.value = '';
      Promise.resolve().then(() => { message.value = text; });
    } else {
      message.value = text;
    }
    scheduleClear();
  }
  function clear(): void {
    message.value = '';
    if (clearHandle !== null) {
      clearTimeout(clearHandle);
      clearHandle = null;
    }
  }
  return { message, announce, clear };
}

/* ------------------------------------------------------------------ */
/* Pure narration helpers — formatted positions for keyboard ops +     */
/* drag/drop outcomes. Position-based wording per the a11y memory.     */
/* ------------------------------------------------------------------ */

/** "position 3 of 5" — 1-indexed user-facing position. */
export function formatPosition(index: number, total: number): string {
  return `position ${index + 1} of ${total}`;
}

/** Announcement for a section insertion (palette → row drop OR a brand
 *  new section programmatically added). */
export function narrateInserted(sectionType: string, at: number, total: number): string {
  return `${sectionType} inserted at ${formatPosition(at, total)}.`;
}

/** Announcement for a within-row reorder. */
export function narrateReordered(
  sectionType: string,
  from: number,
  to: number,
  total: number,
): string {
  return `${sectionType} moved from ${formatPosition(from, total)} to ${formatPosition(to, total)}.`;
}

/** Announcement for a Move Up / Move Down keyboard operation when the
 *  section can't move further (already at start/end). Used so the user
 *  isn't left wondering why the press didn't do anything. */
export function narrateMoveBlocked(sectionType: string, direction: 'up' | 'down'): string {
  return `${sectionType} already at the ${direction === 'up' ? 'first' : 'last'} position.`;
}
