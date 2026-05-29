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
