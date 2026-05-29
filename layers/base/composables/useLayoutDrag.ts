/**
 * useLayoutDrag — pure drag-drop dispatcher logic.
 *
 * Phase 3b/A. Owns the "what to do when X drops on Y" semantics so the
 * component wiring (`<LayoutRow>` + palette tile in upcoming commits)
 * stays a thin shell over these pure functions. Two motivations:
 *
 *   1. **Testability** — dispatcher behavior is unit-tested with plain
 *      objects + no dnd-kit infrastructure. The component layer only
 *      proves `makeDroppable` is called with the right options.
 *   2. **One source of truth** — when 3b/B adds cross-zone drag + when
 *      3f adds drag-from-inspector, the same dispatcher routes them.
 *      No "every component reinvents the drop semantics" drift.
 *
 * Drag payload shape: every drag carries `{ kind, ...details }` so the
 * row's onDrop handler can branch on `kind` without sniffing arbitrary
 * data. Palette tiles carry the section's registry def; section
 * instances carry the section + source row id.
 *
 * Mutations are applied DIRECTLY to the row.sections array. The editor's
 * deep watcher on `editor.draft.value` picks them up + bumps dirty +
 * the existing auto-save composable schedules a save within 1.5s. No
 * parallel save path — Phase 3b/A kickoff rule.
 */
import type { LayoutSection, LayoutRow } from './useLayout';
import type { SectionDefinition } from '@commonpub/ui';
import type { IDragEvent } from '@vue-dnd-kit/core';

/* ------------------------------------------------------------------ */
/* Drag payload taxonomy                                                */
/* ------------------------------------------------------------------ */

/**
 * Discriminator on every drag payload. Matched by a fast switch in
 * `dispatchSectionDrop` — adding a new kind is one literal + one case.
 */
export type DragPayloadKind = 'palette-section-spec' | 'section-instance';

/**
 * Payload carried by a palette tile drag. The tile knows the section's
 * registry def; the drop handler asks the registry to mint a new
 * `LayoutSection` from the def's `defaultConfig` + `defaultColSpan`.
 *
 * We pass the FULL def (not just `type`) because the registry isn't
 * trivially accessible from every drop handler — the row may not have
 * the registry plumbed in. Passing the def avoids an extra dependency.
 */
export interface PaletteSectionDragPayload {
  kind: 'palette-section-spec';
  /** Section type slug — matches the def's `type`. */
  sectionType: string;
  /** Default config + colSpan to mint the new section from. */
  defaultConfig: Record<string, unknown>;
  defaultColSpan: number;
  schemaVersion: number;
}

/**
 * Payload carried by a section-instance drag (drag a section from one
 * row to reorder or move to another row). 3b/A scope is within-row
 * reorder; 3b/B adds cross-row + cross-zone.
 */
export interface SectionInstanceDragPayload {
  kind: 'section-instance';
  /** The section being dragged (deep-cloned NOT — the drop handler
   *  works in terms of identity/id, not by-value). */
  section: LayoutSection;
  /** The row this section currently lives in — needed for cross-row
   *  moves so the dispatcher can remove it from its source. */
  fromRowId: string;
}

export type DragPayload = PaletteSectionDragPayload | SectionInstanceDragPayload;

/* ------------------------------------------------------------------ */
/* Section factory                                                      */
/* ------------------------------------------------------------------ */

/**
 * Mint a new `LayoutSection` from a registry definition. Uses the
 * project's `crypto.randomUUID()` idiom (matches packages/server,
 * layers/base/pages/learn/.../edit.vue). `enabled: true` so a fresh
 * drop is immediately visible; `responsive: null` defers per-breakpoint
 * tuning to Phase 3f's inspector.
 *
 * Pure — takes a def + returns a section. No mutation of inputs.
 */
export function createSectionFromSpec(def: PaletteSectionDragPayload): LayoutSection {
  return {
    id: crypto.randomUUID(),
    order: 0, // server-side write handler renumbers; client value isn't authoritative
    type: def.sectionType,
    config: { ...def.defaultConfig },
    colSpan: def.defaultColSpan,
    responsive: null,
    enabled: true,
    visibility: null,
    schemaVersion: def.schemaVersion,
  };
}

/**
 * Build a palette drag payload from a registry section def. Called by
 * `<AdminLayoutsPalette>` when wiring `makeDraggable` on each tile.
 * Lives here so the drop handler's expectation + the drag source's
 * production stay in lockstep.
 */
export function paletteDragPayload(def: SectionDefinition): PaletteSectionDragPayload {
  return {
    kind: 'palette-section-spec',
    sectionType: def.type,
    defaultConfig: { ...def.defaultConfig },
    defaultColSpan: def.defaultColSpan,
    schemaVersion: def.schemaVersion,
  };
}

/* ------------------------------------------------------------------ */
/* Insert-index computation                                             */
/* ------------------------------------------------------------------ */

/**
 * Where in `row.sections` to insert the dropped item. Read from
 * dnd-kit's `event.hoveredDraggable` (the section currently under the
 * cursor inside the row):
 *
 *   - No hovered draggable → append to the end (drop on empty area).
 *   - Hovered draggable with placement.left/top → insert BEFORE it.
 *   - Hovered draggable with placement.right/bottom → insert AFTER it.
 *
 * Rows are horizontal; `left`/`right` are the primary signals.
 * `top`/`bottom` are checked as fallbacks for vertical-list mode (which
 * we'll use for cross-row reordering in 3b/B's stacked-zones layout —
 * the computation is reused there).
 *
 * Pure. Takes the event + the fallback length. Returns an integer in
 * `[0, fallbackLen]` (the half-open range that `Array.prototype.splice`
 * accepts as an insert position).
 */
export function computeInsertIndex(event: IDragEvent, fallbackLen: number): number {
  const hovered = event.hoveredDraggable;
  if (!hovered) return fallbackLen; // append
  const insertBefore = hovered.placement.left || hovered.placement.top;
  return insertBefore ? hovered.index : hovered.index + 1;
}

/* ------------------------------------------------------------------ */
/* Drop dispatcher                                                      */
/* ------------------------------------------------------------------ */

/**
 * Outcome of a dispatched drop — useful for callers that want to
 * narrate the result (ARIA live region, audit log, telemetry) without
 * sniffing the row's array.
 */
export type DropOutcome =
  | { kind: 'inserted'; section: LayoutSection; at: number }
  | { kind: 'reordered'; section: LayoutSection; from: number; to: number }
  | { kind: 'noop'; reason: string };

/**
 * Apply a drop to a row. The row's `sections` array is mutated in
 * place — the editor's deep watcher picks it up + auto-save fires.
 *
 * 3b/A scope:
 *   - palette-section-spec → splice in a fresh section at the computed
 *     insert index.
 *   - section-instance dragged FROM THIS SAME ROW → reorder in place
 *     via splice-remove + splice-insert (sameList per dnd-kit's model).
 *   - section-instance dragged FROM A DIFFERENT ROW → noop in 3b/A
 *     (cross-row + cross-zone arrive in 3b/B).
 *
 * Returns a DropOutcome describing what happened. `noop` outcomes have
 * a `reason` for diagnostics — surfaced in tests + (optionally) audit
 * logs.
 */
export function dispatchSectionDrop(
  event: IDragEvent,
  row: LayoutRow,
): DropOutcome {
  const item = event.draggedItems[0]?.item as DragPayload | undefined;
  if (!item) return { kind: 'noop', reason: 'no-dragged-item' };

  if (item.kind === 'palette-section-spec') {
    const newSection = createSectionFromSpec(item);
    const insertAt = computeInsertIndex(event, row.sections.length);
    row.sections.splice(insertAt, 0, newSection);
    return { kind: 'inserted', section: newSection, at: insertAt };
  }

  if (item.kind === 'section-instance') {
    if (item.fromRowId !== row.id) {
      // Cross-row drag — deferred to Phase 3b/B (cross-zone arc).
      return { kind: 'noop', reason: 'cross-row-deferred-to-3b-B' };
    }
    const fromIdx = row.sections.findIndex((s) => s.id === item.section.id);
    if (fromIdx === -1) {
      // The dragged section isn't in this row's array — defensive
      // against a stale payload or a concurrent edit that removed it.
      return { kind: 'noop', reason: 'section-not-found' };
    }
    // Compute the target index using the row's CURRENT sections (the
    // dragged section is still there). After splice-remove the indices
    // shift down by 1 for positions after fromIdx — adjust on insert.
    const targetIdx = computeInsertIndex(event, row.sections.length);
    const [moved] = row.sections.splice(fromIdx, 1);
    // Adjust if removing the source shifted the target.
    const adjustedTarget = targetIdx > fromIdx ? targetIdx - 1 : targetIdx;
    row.sections.splice(adjustedTarget, 0, moved);
    return { kind: 'reordered', section: moved, from: fromIdx, to: adjustedTarget };
  }

  // Exhaustive switch: TS narrows `item` to `never` here. Any new kind
  // will surface as a compile error → forces an explicit case.
  return { kind: 'noop', reason: 'unknown-drag-kind' };
}
