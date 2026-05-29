/**
 * useLayoutHistory — undo / redo for the layout editor.
 *
 * Phase 3b/B. Plan §7.14: in-memory stack of LayoutOps, each operation
 * captures its inverse, cap 50, cleared on Save (saved draft = new
 * baseline; redo across save is hostile) AND on refresh (the local
 * draft was replaced — old commands reference vanished section ids).
 *
 * Module-scoped singleton matching `useLayoutAnnouncer` +
 * `useEditorChrome`. The kickoff prompt named "Pinia store" but the
 * monorepo has zero Pinia surfaces; adding `pinia` + `@pinia/nuxt` +
 * provider plumbing + new test patterns for ONE store creates the
 * cruft the user has explicitly flagged. The semantic — "command
 * pattern undo/redo with the documented contract" — is satisfied
 * cleanly by a module-scoped reactive ref. Same lifetime (editor
 * mounts → unmounts → next mount calls `clear()` to reset). See
 * session 164 log for the deviation rationale.
 *
 * Command pattern:
 *   `apply(draft)`  — performs the operation; called on the original
 *                     mutation's redo (the dispatcher does it once at
 *                     record time; the command stores a CLOSURE so the
 *                     same op can replay on Cmd+Shift+Z).
 *   `invert(draft)` — performs the operation's reverse; called on undo.
 *   `label`         — human copy for narration + tooltips ("move hero").
 *   `timestamp`     — when recorded (for diagnostics / future "undo
 *                     history" UI; not load-bearing today).
 *
 * Both apply + invert are idempotent in the sense that a re-find by
 * `section.id` survives the previous command's mutations. The stack
 * is strict LIFO — between record and the matching undo, no other
 * command can have shifted the state in a way that breaks the find.
 *
 * Stack semantics (Notion / Linear / Figma convention):
 *   - `record(cmd)` pushes to `past` AND clears `future` (a new action
 *     after undo invalidates the prior redo branch — same rule mature
 *     editors converged on).
 *   - `undo(draft)` pops `past`, runs `cmd.invert(draft)`, pushes the
 *     same cmd to `future`. Returns the cmd so the caller can announce.
 *   - `redo(draft)` pops `future`, runs `cmd.apply(draft)`, pushes back
 *     to `past`. Symmetrical.
 *   - `clear()` empties both stacks; called on save success + refresh.
 *
 * Cap: 50 commands in `past`. When recording past[50], shift the oldest
 * out. `future` is not capped — only built by undo, which is bounded by
 * past.
 */
import { computed, markRaw, ref, type ComputedRef, type Ref } from 'vue';
import type { LayoutRecord } from '@commonpub/server';
import type { LayoutSection, LayoutRow } from './useLayout';

/** One reversible operation. `apply` + `invert` are pure with respect
 *  to the rest of the system — they mutate ONLY the passed draft. */
export interface LayoutCommand {
  apply: (draft: LayoutRecord) => void;
  invert: (draft: LayoutRecord) => void;
  /** Human-readable label for narration + toolbar tooltips. */
  label: string;
  /** Recorded at — Date.now() at record-time. */
  timestamp: number;
}

/** Cap chosen to match plan §7.14. Mature editors converge on 50–100;
 *  50 keeps memory bounded (~50 × small JSON ≈ tens of KB at most). */
const STACK_CAP = 50;

const past = ref<LayoutCommand[]>([]);
const future = ref<LayoutCommand[]>([]);

export interface LayoutHistory {
  past: Ref<LayoutCommand[]>;
  future: Ref<LayoutCommand[]>;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
  /** Top of `past` — the next thing `undo()` will revert. Drives the
   *  toolbar's undo button tooltip ("Undo: move hero"). */
  lastLabel: ComputedRef<string | null>;
  /** Top of `future` — the next thing `redo()` will replay. Drives the
   *  redo button tooltip. */
  nextLabel: ComputedRef<string | null>;
  /** Record a command AFTER mutating the draft. The mutation already
   *  happened (the dispatcher / Move Up handler did it); this just
   *  remembers how to invert + how to replay. Clears `future` (new
   *  branch invalidates redo). */
  record: (cmd: LayoutCommand) => void;
  /** Undo the most recent command. Returns it so the caller can
   *  narrate. Noop + returns null when `past` is empty. */
  undo: (draft: LayoutRecord) => LayoutCommand | null;
  /** Redo the most recently undone command. Returns it for narration.
   *  Noop + returns null when `future` is empty. */
  redo: (draft: LayoutRecord) => LayoutCommand | null;
  /** Empty both stacks. Called on save success + refresh. */
  clear: () => void;
}

export function useLayoutHistory(): LayoutHistory {
  const canUndo = computed<boolean>(() => past.value.length > 0);
  const canRedo = computed<boolean>(() => future.value.length > 0);
  const lastLabel = computed<string | null>(() => {
    const last = past.value[past.value.length - 1];
    return last ? last.label : null;
  });
  const nextLabel = computed<string | null>(() => {
    const next = future.value[future.value.length - 1];
    return next ? next.label : null;
  });

  function record(cmd: LayoutCommand): void {
    // markRaw so Vue's reactive proxy doesn't wrap the command. The
    // command contains closures (`apply` + `invert`); we don't want
    // the array's proxy to re-wrap the cmd on every read, which would
    // (a) break reference-identity assertions (`undo()` returning the
    // exact command the caller recorded — useful for telemetry +
    // tests), and (b) waste a Proxy per command. Only the array
    // length needs to be reactive — that comes from the outer ref().
    const rawCmd = markRaw(cmd);
    // Cap enforcement: shift the oldest out so memory stays bounded.
    // Done BEFORE push so the resulting length is exactly STACK_CAP.
    // Mutate in place so reactive readers (toolbar buttons) re-evaluate.
    if (past.value.length >= STACK_CAP) past.value.shift();
    past.value.push(rawCmd);
    // New action invalidates the redo branch — Notion/Linear/Figma
    // convention. Without this, redo would replay stale commands
    // against a state that no longer matches their expectations.
    if (future.value.length > 0) future.value = [];
  }

  function undo(draft: LayoutRecord): LayoutCommand | null {
    const cmd = past.value.pop();
    if (!cmd) return null;
    cmd.invert(draft);
    future.value.push(cmd);
    return cmd;
  }

  function redo(draft: LayoutRecord): LayoutCommand | null {
    const cmd = future.value.pop();
    if (!cmd) return null;
    cmd.apply(draft);
    past.value.push(cmd);
    return cmd;
  }

  function clear(): void {
    past.value = [];
    future.value = [];
  }

  return { past, future, canUndo, canRedo, lastLabel, nextLabel, record, undo, redo, clear };
}

/* ------------------------------------------------------------------ */
/* Command factories — one per layout op.                              */
/* ------------------------------------------------------------------ */
/*
 * Each factory closes over the parameters needed for both apply +
 * invert. The factories live with the history (vs co-located with the
 * drag dispatcher) so that:
 *   1. The undo invariant is centralised. Wrong apply/invert is the
 *      easiest mistake; one file makes the symmetry visually obvious.
 *   2. Tests for the factories exercise apply + invert as a pair
 *      against a fixture draft — independent of the dispatcher /
 *      drag-drop UI.
 *
 * The factories DO mutate the draft on apply/invert. They do NOT call
 * history.record(); the caller decides whether to record (test code
 * may want apply-without-record for fixture setup).
 */

/** Deep-clone a section so the invert can re-insert the SAME-shape
 *  payload even if the live one is later edited. */
function cloneSection(s: LayoutSection): LayoutSection {
  return JSON.parse(JSON.stringify(s)) as LayoutSection;
}

/** Walk zones → rows to find a row by id. Returns null if vanished. */
export function findRowInDraft(draft: LayoutRecord, rowId: string): LayoutRow | null {
  for (const zone of draft.zones) {
    for (const row of zone.rows) {
      if (row.id === rowId) return row as LayoutRow;
    }
  }
  return null;
}

/** Walk zones → rows to find the zone slug containing a given row. */
export function findZoneOfRow(draft: LayoutRecord, rowId: string): string | null {
  for (const zone of draft.zones) {
    for (const row of zone.rows) {
      if (row.id === rowId) return zone.zone;
    }
  }
  return null;
}

/**
 * Walk zones → rows → sections to locate a section by id. Phase 3d
 * keystrokes (Backspace, Cmd+D) work from an EditorSelection that
 * carries only the section id — finding the host row + zone + index
 * needs a search. O(zones × rows × sections); fine at v1 N=10s.
 *
 * Returns null when the section is no longer in the draft (e.g. the
 * selection went stale because a drag mid-keydown removed it).
 */
export interface SectionLocation {
  zoneSlug: string;
  row: LayoutRow;
  idx: number;
  section: LayoutSection;
}
export function findSectionLocation(
  draft: LayoutRecord,
  sectionId: string,
): SectionLocation | null {
  for (const zone of draft.zones) {
    for (const row of zone.rows) {
      const idx = (row.sections as LayoutSection[]).findIndex((s) => s.id === sectionId);
      if (idx !== -1) {
        const section = (row.sections as LayoutSection[])[idx]!;
        return { zoneSlug: zone.zone, row: row as LayoutRow, idx, section };
      }
    }
  }
  return null;
}

/**
 * Palette → row insert.
 *
 *   apply:  splice the section into row at `at`
 *   invert: remove the section from the row by id
 */
export function insertSectionCommand(params: {
  rowId: string;
  at: number;
  section: LayoutSection;
  label?: string;
}): LayoutCommand {
  const sectionClone = cloneSection(params.section);
  const label = params.label ?? `insert ${params.section.type}`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      // Use a fresh clone each apply so undo→redo cycles don't share a
      // mutated object. (Vue's reactivity proxies the live tree; the
      // clone stays independent.)
      row.sections.splice(params.at, 0, cloneSection(sectionClone));
    },
    invert(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      const idx = row.sections.findIndex((s) => s.id === sectionClone.id);
      if (idx === -1) return;
      row.sections.splice(idx, 1);
    },
  };
}

/**
 * Within-row reorder.
 *
 *   apply:  remove from `from`, insert at `to`
 *   invert: reverse — remove from `to`, insert at `from`
 */
export function reorderSectionCommand(params: {
  rowId: string;
  sectionId: string;
  from: number;
  to: number;
  label?: string;
}): LayoutCommand {
  const label = params.label ?? `reorder section`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      const idx = row.sections.findIndex((s) => s.id === params.sectionId);
      if (idx === -1) return;
      const [moved] = row.sections.splice(idx, 1);
      if (!moved) return;
      row.sections.splice(params.to, 0, moved);
    },
    invert(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      const idx = row.sections.findIndex((s) => s.id === params.sectionId);
      if (idx === -1) return;
      const [moved] = row.sections.splice(idx, 1);
      if (!moved) return;
      row.sections.splice(params.from, 0, moved);
    },
  };
}

/**
 * Add a new row to a zone.
 *
 *   apply:  splice the row into zone.rows at `position`
 *   invert: remove the row by id
 *
 * Used by the "+ Add row" canvas button (plan §7.2). The row's sections
 * are typically empty at add-time, but the command stores a deep clone
 * so future "duplicate row" callers (which pre-populate sections) work
 * with the same factory. Undo of an add-row removes the WHOLE row +
 * any sections that landed in it after the add.
 */
export function addRowCommand(params: {
  zoneSlug: string;
  position: number;
  row: LayoutRow;
  label?: string;
}): LayoutCommand {
  const rowClone = JSON.parse(JSON.stringify(params.row)) as LayoutRow;
  const label = params.label ?? `add row`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const zone = draft.zones.find((z) => z.zone === params.zoneSlug);
      if (!zone) return;
      // Fresh clone each apply so undo→redo doesn't share a mutated object.
      zone.rows.splice(params.position, 0, JSON.parse(JSON.stringify(rowClone)));
    },
    invert(draft) {
      const zone = draft.zones.find((z) => z.zone === params.zoneSlug);
      if (!zone) return;
      const idx = zone.rows.findIndex((r) => r.id === rowClone.id);
      if (idx === -1) return;
      zone.rows.splice(idx, 1);
    },
  };
}

/**
 * Remove a row from a zone.
 *
 *   apply:  remove the row by id from zone.rows
 *   invert: restore the row at `position` (clamped if the zone now has
 *           fewer rows)
 *
 * Symmetric pair with `addRowCommand`. The full row (including any
 * sections it contained at remove-time) is deep-cloned + stored on the
 * command so the invert restores the row's contents — Cmd+Z after a
 * row removal brings back the sections too.
 */
export function removeRowCommand(params: {
  zoneSlug: string;
  position: number;
  row: LayoutRow;
  label?: string;
}): LayoutCommand {
  const rowClone = JSON.parse(JSON.stringify(params.row)) as LayoutRow;
  const label = params.label ?? `remove row`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const zone = draft.zones.find((z) => z.zone === params.zoneSlug);
      if (!zone) return;
      const idx = zone.rows.findIndex((r) => r.id === rowClone.id);
      if (idx === -1) return;
      zone.rows.splice(idx, 1);
    },
    invert(draft) {
      const zone = draft.zones.find((z) => z.zone === params.zoneSlug);
      if (!zone) return;
      // Clamp to the current length — intervening commands may have
      // removed other rows, putting our captured position out of range.
      const pos = Math.min(params.position, zone.rows.length);
      zone.rows.splice(pos, 0, JSON.parse(JSON.stringify(rowClone)));
    },
  };
}

/**
 * Remove a section from a row.
 *
 *   apply:  remove the section by id from row.sections
 *   invert: restore the section at `position` (clamped if the row now has
 *           fewer sections)
 *
 * Symmetric pair with `insertSectionCommand`. Phase 3d.1 (Backspace /
 * Delete) records this. The full section (config + responsive + every
 * authored field) is deep-cloned + stored on the command so the invert
 * restores complete content — Cmd+Z after a section removal brings the
 * authored copy back, not just the type stub.
 */
export function removeSectionCommand(params: {
  rowId: string;
  position: number;
  section: LayoutSection;
  label?: string;
}): LayoutCommand {
  const sectionClone = cloneSection(params.section);
  const label = params.label ?? `remove ${params.section.type}`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      const idx = row.sections.findIndex((s) => s.id === sectionClone.id);
      if (idx === -1) return;
      row.sections.splice(idx, 1);
    },
    invert(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      // Clamp to current length — intervening commands may have removed
      // other sections, pushing our captured position out of range.
      const pos = Math.min(params.position, row.sections.length);
      row.sections.splice(pos, 0, cloneSection(sectionClone));
    },
  };
}

/**
 * Duplicate a section in place — clones the source, inserts directly
 * after it. Phase 3d.2 (Cmd/Ctrl+D).
 *
 *   apply:  splice `clone` into row at `at`
 *   invert: remove `clone` by id
 *
 * The clone's id MUST be unique within the layout — the caller mints
 * it via `crypto.randomUUID()` BEFORE building the command, so apply +
 * invert can both find the same instance across undo/redo cycles.
 *
 * Practically equivalent to `insertSectionCommand` for purposes of
 * apply/invert, but kept as a separate factory because:
 *   1. The label defaults differ (`duplicate hero` vs `insert hero`),
 *      which surfaces in the toolbar tooltip + screen-reader narration.
 *      Telling the user "you can undo the insert" when the action was a
 *      duplicate is jarring.
 *   2. Tests + audit lenses can target duplicate semantics specifically
 *      (e.g. "does the new id collide with the source?"). One factory
 *      per intent matches the convention the row commands already set.
 */
export function duplicateSectionCommand(params: {
  rowId: string;
  at: number;
  clone: LayoutSection;
  label?: string;
}): LayoutCommand {
  const clone = cloneSection(params.clone);
  const label = params.label ?? `duplicate ${clone.type}`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      // Fresh clone on each apply so undo→redo cycles don't share a
      // mutated object — same rule the other factories follow.
      row.sections.splice(params.at, 0, cloneSection(clone));
    },
    invert(draft) {
      const row = findRowInDraft(draft, params.rowId);
      if (!row) return;
      const idx = row.sections.findIndex((s) => s.id === clone.id);
      if (idx === -1) return;
      row.sections.splice(idx, 1);
    },
  };
}

/**
 * Resize a section + (optionally) its right neighbour. Phase 3c.
 *
 *   apply:  set section.colSpan to `toColSpan`; if neighbourId present,
 *           set neighbour.colSpan to `neighbourToColSpan`
 *   invert: restore both to their `*FromColSpan`
 *
 * The pointer-drag handler in `useLayoutResize` mutates the live draft
 * during the gesture (for live preview); on pointer-release it commits
 * ONE command capturing the start + end values. A drag-back-to-original
 * (toColSpan === fromColSpan AND no neighbour change) is a no-op the
 * caller filters before recording — keeps the stack from filling with
 * self-equal entries (mirrors the reorder dispatcher's `from===to` skip).
 *
 * Neighbour semantics:
 *   - `neighbourId === null` → section is LAST in its row; neighbour
 *     fields are unused. Plain colSpan swap.
 *   - `neighbourId` set → both sections were in the same row at command-
 *     record time; the apply/invert restores both. The `findSectionLocation`
 *     walks zones → rows → sections by id, so neither cares about the
 *     specific row index — robust against intervening reorders.
 *
 * Idempotence + intervening commands: if either section was deleted
 * between record + replay, the corresponding find returns null and
 * that side is silently skipped — same defensive shape as the other
 * factories. Cmd+Z on a deleted section's resize is a quiet noop.
 *
 * Symmetric pair design (no separate factory for keyboard vs pointer):
 * Shift+Arrow keyboard resize records the same command shape; the only
 * difference is `label` ("resize hero (keyboard)" vs default "resize
 * section") so narration tells SR users which input drove it.
 */
export function resizeSectionCommand(params: {
  rowId: string;
  sectionId: string;
  fromColSpan: number;
  toColSpan: number;
  /** Right neighbour at resize-start. Null when the resized section
   *  was LAST in its row (no absorption — extends to row edge). */
  neighbourId: string | null;
  neighbourFromColSpan?: number;
  neighbourToColSpan?: number;
  label?: string;
}): LayoutCommand {
  const label = params.label ?? `resize section`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const loc = findSectionLocation(draft, params.sectionId);
      if (loc) loc.section.colSpan = params.toColSpan;
      if (params.neighbourId && params.neighbourToColSpan !== undefined) {
        const nLoc = findSectionLocation(draft, params.neighbourId);
        if (nLoc) nLoc.section.colSpan = params.neighbourToColSpan;
      }
    },
    invert(draft) {
      const loc = findSectionLocation(draft, params.sectionId);
      if (loc) loc.section.colSpan = params.fromColSpan;
      if (params.neighbourId && params.neighbourFromColSpan !== undefined) {
        const nLoc = findSectionLocation(draft, params.neighbourId);
        if (nLoc) nLoc.section.colSpan = params.neighbourFromColSpan;
      }
    },
  };
}

/**
 * Cross-row / cross-zone move.
 *
 *   apply:  remove from sourceRow at fromIdx, insert into destRow at toIdx
 *   invert: reverse — remove from destRow, insert back into sourceRow
 *
 * If either row vanishes between record + replay, the command short-
 * circuits silently (the section vanished too, so there's nothing
 * useful to do). The history's strict LIFO ordering makes this
 * scenario rare: it only happens if a concurrent refresh replaced
 * draft mid-stack, in which case `clear()` should have fired.
 */
export function moveSectionCommand(params: {
  fromRowId: string;
  toRowId: string;
  sectionId: string;
  fromIdx: number;
  toIdx: number;
  label?: string;
}): LayoutCommand {
  const label = params.label ?? `move section`;
  return {
    label,
    timestamp: Date.now(),
    apply(draft) {
      const from = findRowInDraft(draft, params.fromRowId);
      const to = findRowInDraft(draft, params.toRowId);
      if (!from || !to) return;
      const idx = from.sections.findIndex((s) => s.id === params.sectionId);
      if (idx === -1) return;
      const [moved] = from.sections.splice(idx, 1);
      if (!moved) return;
      to.sections.splice(params.toIdx, 0, moved);
    },
    invert(draft) {
      const from = findRowInDraft(draft, params.fromRowId);
      const to = findRowInDraft(draft, params.toRowId);
      if (!from || !to) return;
      const idx = to.sections.findIndex((s) => s.id === params.sectionId);
      if (idx === -1) return;
      const [moved] = to.sections.splice(idx, 1);
      if (!moved) return;
      from.sections.splice(params.fromIdx, 0, moved);
    },
  };
}
