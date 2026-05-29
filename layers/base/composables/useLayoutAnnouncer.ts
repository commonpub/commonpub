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

/* ------------------------------------------------------------------ */
/* Two narration channels — assertive (drag/drop) + polite (undo/redo) */
/* ------------------------------------------------------------------ */
/*
 * Drag/drop state changes are TIME-CRITICAL: the user's next keypress
 * lands on whichever drop target is currently under the cursor; missing
 * the previous narration means flying blind on the next step. That
 * earns `aria-live="assertive"`.
 *
 * Undo / redo confirmations are INFORMATIONAL: the user is telling the
 * editor what to do, the editor is acknowledging. Interrupting another
 * narration (e.g. a save status) to announce "Undid: …" is louder than
 * the action warrants. That earns `aria-live="polite"` — the screen
 * reader queues it for the next quiet moment.
 *
 * Mixing both channels into one assertive region would push undo
 * confirmations to interrupt drag narration, which is the opposite of
 * what we want. So two separate refs + a separate role="status"
 * polite mirror in <AdminLayoutsAnnouncer>.
 */

const message = ref<string>('');
const politeMessage = ref<string>('');

/** Auto-clear handles so stale messages don't linger for the next
 *  announcement (when the new message would be identical to the
 *  lingering one, some screen readers don't re-announce). One handle
 *  per channel so the timers don't clobber each other. */
let clearHandle: ReturnType<typeof setTimeout> | null = null;
let politeClearHandle: ReturnType<typeof setTimeout> | null = null;
const CLEAR_AFTER_MS = 1200;

function scheduleClear(): void {
  if (typeof window === 'undefined') return;
  if (clearHandle !== null) clearTimeout(clearHandle);
  clearHandle = setTimeout(() => {
    message.value = '';
    clearHandle = null;
  }, CLEAR_AFTER_MS);
}

function schedulePoliteClear(): void {
  if (typeof window === 'undefined') return;
  if (politeClearHandle !== null) clearTimeout(politeClearHandle);
  politeClearHandle = setTimeout(() => {
    politeMessage.value = '';
    politeClearHandle = null;
  }, CLEAR_AFTER_MS);
}

export interface LayoutAnnouncer {
  /** The current ASSERTIVE narration text — drag/drop state changes.
   *  Bound to the announcer component's aria-live="assertive" region. */
  message: Ref<string>;
  /** The current POLITE narration text — undo/redo + non-time-critical
   *  confirmations. Bound to the announcer component's separate
   *  aria-live="polite" region. */
  politeMessage: Ref<string>;
  /** Set the assertive message + schedule an auto-clear. Calling
   *  announce() twice in quick succession REPLACES the previous
   *  message (last-write-wins) — the user only cares about the
   *  most-recent state. */
  announce: (text: string) => void;
  /** Set the polite message — for undo/redo confirmations + other
   *  informational acknowledgements. Same last-write-wins semantics. */
  announcePolite: (text: string) => void;
  /** Immediately clear BOTH channels. Called on editor unmount to
   *  prevent the message lingering into the next page. */
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
  function announcePolite(text: string): void {
    if (politeMessage.value === text) {
      politeMessage.value = '';
      Promise.resolve().then(() => { politeMessage.value = text; });
    } else {
      politeMessage.value = text;
    }
    schedulePoliteClear();
  }
  function clear(): void {
    message.value = '';
    politeMessage.value = '';
    if (clearHandle !== null) {
      clearTimeout(clearHandle);
      clearHandle = null;
    }
    if (politeClearHandle !== null) {
      clearTimeout(politeClearHandle);
      politeClearHandle = null;
    }
  }
  return { message, politeMessage, announce, announcePolite, clear };
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

/**
 * Cross-zone move narration — Phase 3b/B. Always position-AND-zone-based:
 * the user needs to hear WHERE the section landed (which zone) plus
 * its new ordinal so the next arrow press has a frame of reference.
 *
 * Sample output: `Hero moved from main, position 3 of 5, to sidebar, position 1 of 2.`
 *
 * Both endpoints carry the zone slug AND the per-row position. The
 * caller computes positions against the LIVE arrays after mutation
 * (so `toTotal` reflects the destination's new length).
 */
export function narrateMovedToZone(
  sectionType: string,
  fromZone: string,
  fromIdx: number,
  fromTotal: number,
  toZone: string,
  toIdx: number,
  toTotal: number,
): string {
  return `${sectionType} moved from ${fromZone}, ${formatPosition(fromIdx, fromTotal)}, to ${toZone}, ${formatPosition(toIdx, toTotal)}.`;
}

/** Undo / redo confirmation. The label describes the operation that
 *  was undone/redone. Routed through `announcePolite` (NOT assertive)
 *  per the channel design at the top of this file. */
export function narrateUndo(label: string): string {
  return `Undid: ${label}.`;
}

export function narrateRedo(label: string): string {
  return `Redid: ${label}.`;
}

/** Hotkey was pressed but the stack was empty in that direction. */
export function narrateUndoEmpty(): string {
  return 'Nothing to undo.';
}

export function narrateRedoEmpty(): string {
  return 'Nothing to redo.';
}

/**
 * "+ Add row" outcome — names the zone + the new row's position so a
 * keyboard user knows where focus lands. Sample:
 *   `Row added in main, position 4 of 4.`
 */
export function narrateRowAdded(zone: string, at: number, total: number): string {
  return `Row added in ${zone}, ${formatPosition(at, total)}.`;
}

/**
 * Row removal — names the zone so the user has a frame of reference
 * for what disappeared. Doesn't include the prior position because
 * by announce-time the row is gone + neighboring rows have shifted.
 */
export function narrateRowRemoved(zone: string): string {
  return `Row removed from ${zone}.`;
}

/**
 * Section removal (Phase 3d.1 — Backspace / Delete).
 *
 * Names the section type + zone so the user knows WHICH section
 * disappeared without having to count remaining ones. Mirrors
 * narrateRowRemoved's "no position" rationale — by announce-time
 * the section is gone + neighbors have shifted, so position would
 * be meaningless. The `Cmd+Z restores` hint is folded into the
 * announcement so screen-reader users hear the recovery affordance
 * (sighted users see the toolbar's enabled Undo button).
 */
export function narrateSectionRemoved(sectionType: string, zone: string): string {
  return `${sectionType} removed from ${zone}. Press Command+Z to undo.`;
}

/**
 * Section duplication (Phase 3d.2 — Cmd/Ctrl+D).
 *
 * The clone lands directly after the source so position is the
 * source's index + 1. Naming both position + total gives the user
 * a frame of reference for the next arrow press; matches
 * narrateInserted's wording so screen-reader output stays consistent
 * regardless of how the section got there (palette drop, duplicate,
 * eventually paste).
 */
export function narrateSectionDuplicated(
  sectionType: string,
  at: number,
  total: number,
): string {
  return `${sectionType} duplicated at ${formatPosition(at, total)}.`;
}

/**
 * Section resize — drag of the right-edge handle OR Shift+Arrow keypress
 * (Phase 3c). Always names the section type + the NEW span "X of 12"
 * because plan §7.5's UX contract is "you can always read your current
 * span aloud" — sighted users see the on-screen pill, SR users need
 * the same fact in the audio channel.
 *
 * Routed through `announce` (NOT `announcePolite`): resize is a
 * positional state change like drag/drop, not informational like undo.
 * The user is mid-gesture (or mid-keystroke) and the next press is
 * relative to the NEW span — they need to hear it NOW.
 *
 * Sample output: `Hero now spans 8 of 12 columns.`
 *
 * Pure helper — no Vue. Callers (the resize composable + the hotkeys
 * composable) pass their own announcer reference + the narrated text.
 */
export function narrateResize(sectionType: string, newColSpan: number): string {
  return `${sectionType} now spans ${newColSpan} of 12 columns.`;
}

/**
 * Section resize hit a hard limit — the user pushed past the section's
 * `minColSpan` / `maxColSpan` OR the right neighbour's own min (Plan §7.5's
 * "constraint snap"). Without this narration the keystroke / drag would
 * fall silent at the boundary, leaving SR users wondering if the press
 * registered.
 *
 * `reason` discriminates so the message names WHICH bound the user hit;
 * the pill near the cursor shows the matching label visually
 * ("🔒 min 3/12") for sighted users.
 *
 *   'section-min'    → the resized section can't shrink further
 *   'section-max'    → the resized section can't grow further
 *   'neighbour-min'  → the right neighbour can't shrink any more
 *
 * The numeric bound is included so the user knows what to aim for
 * with the next press ("can't go below 3 of 12 columns").
 *
 * Routed through `announce` (assertive) so it interrupts an in-flight
 * resize narration — the user's next press needs the updated frame of
 * reference.
 */
export function narrateResizeBlocked(
  sectionType: string,
  reason: 'section-min' | 'section-max' | 'neighbour-min',
  bound: number,
): string {
  if (reason === 'section-min') {
    return `${sectionType} can't go below ${bound} of 12 columns.`;
  }
  if (reason === 'section-max') {
    return `${sectionType} can't go above ${bound} of 12 columns.`;
  }
  // 'neighbour-min' — the bound is the neighbour's min. Wording names the
  // neighbour as the blocker so the user knows resizing the OTHER section
  // (or removing it) is what unblocks them.
  return `${sectionType} can't grow further; next section at minimum ${bound} of 12 columns.`;
}
