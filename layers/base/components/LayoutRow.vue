<script setup lang="ts">
/**
 * <LayoutRow> — renders one row of a zone (a horizontal strip in the
 * 12-column grid) PLUS the sections inside it. Extracted from
 * <LayoutSlot> in Phase 3b/A so each row can own its own
 * `makeDroppable` template ref — dnd-kit composables can only be
 * called once per component instance, so one row instance per
 * component instance is the natural fit.
 *
 * Public render path: editable=false → makeDroppable is disabled +
 * tabindex/role/aria are unset on sections + no click handlers wire.
 * Byte-pattern identical to the inline render that used to live in
 * <LayoutSlot> (the existing LayoutSlot tests query for the same
 * .cpub-layout-row / .cpub-layout-section / data-* shape).
 *
 * Editable path: makeDroppable enabled; the row accepts palette tile
 * drops + (commit F) section-instance drops. Drop handling is
 * delegated to the pure `dispatchSectionDrop` function in
 * useLayoutDrag.ts — this component is wiring only.
 */
import { computed, ref } from 'vue';
import { makeDroppable, type IDragEvent } from '@vue-dnd-kit/core';
import type { LayoutSection, LayoutRow } from '../composables/useLayout';
import type { EditorSelection } from '../composables/useLayoutEditor';
import { dispatchSectionDrop } from '../composables/useLayoutDrag';
import {
  useLayoutAnnouncer,
  narrateInserted,
  narrateReordered,
  narrateMoveBlocked,
  narrateMovedToZone,
} from '../composables/useLayoutAnnouncer';
import {
  useLayoutHistory,
  insertSectionCommand,
  reorderSectionCommand,
  moveSectionCommand,
} from '../composables/useLayoutHistory';
import LayoutSectionComponent from './LayoutSection.vue';

const props = withDefaults(defineProps<{
  /** The row's reactive object — mutating row.sections here is picked
   *  up by the editor's deep watcher on draft (no callback needed). */
  row: LayoutRow;
  /** Forwarded from LayoutSlot — used by the section's render meta. */
  route: string;
  /** Zone slug — used by the section's render meta. */
  zone: string;
  /** When true, paint editor chrome + enable selection + makeDroppable. */
  editable?: boolean;
  /** True when the parent LayoutSlot has previewOverride — gates the
   *  section's meta.isPreview flag. */
  isPreview?: boolean;
  /** Selection callback — passed verbatim from LayoutSlot. */
  onSelect?: (selection: EditorSelection) => void;
  /** Currently-selected target. */
  selectedId?: EditorSelection | null;
  /**
   * Phase 3b/B — cross-zone lookup. Synthesised by AdminLayoutsCanvas
   * from the editor's draft + threaded through LayoutSlot. When present,
   * the row's drop handler can route cross-row drops (section dragged
   * from a different row in either the same OR a different zone).
   * When absent (public render path / tests), cross-row drops noop.
   */
  findRow?: (rowId: string) => LayoutRow | null;
  /**
   * Phase 3b/B — zone-of-row lookup. Used to narrate cross-zone moves
   * ("Hero moved from main, position 3 of 5, to sidebar, position 1
   * of 2"). Optional — when absent, cross-row narration falls back to
   * the position-only `narrateReordered` form.
   */
  findZone?: (rowId: string) => string | null;
  /**
   * Phase 3b/B — all zone slugs in the layout. Drives the "Move to
   * zone…" popover's option list. The row filters out its OWN zone
   * before passing the list to its sections.
   */
  zoneSlugs?: string[];
  /** Phase 3b/B — first-row-in-zone lookup; landing target for the
   *  "Move to zone…" keyboard path. */
  findFirstRowInZone?: (zoneSlug: string) => LayoutRow | null;
}>(), {
  editable: false,
  isPreview: false,
  onSelect: undefined,
  selectedId: null,
  findRow: undefined,
  findZone: undefined,
  zoneSlugs: () => [],
  findFirstRowInZone: undefined,
});

/*
 * Visibility filter — features + roles + enabled. hideAt is a CSS-side
 * filter applied inside <LayoutSection> via data-* attrs. Selection +
 * click handling + drag wiring + colSpan resolution all live in
 * <LayoutSection> now.
 */
const features = useFeatures();
const { isAuthenticated, user } = useAuth();

function isFeatureOn(featureGate: string | undefined): boolean {
  if (!featureGate) return true;
  return (features.features.value as unknown as Record<string, boolean>)?.[featureGate] ?? false;
}

function currentRole(): string {
  if (!isAuthenticated.value) return 'anonymous';
  return user.value?.role ?? 'member';
}

function sectionVisible(s: LayoutSection): boolean {
  if (!s.enabled) return false;
  const v = s.visibility;
  if (!v) return true;
  if (v.features && v.features.some((f: string) => !isFeatureOn(f))) return false;
  if (v.roles && v.roles.length > 0 && !v.roles.includes(currentRole())) return false;
  return true;
}

const rowIsSelected = computed<boolean>(() => {
  const sel = props.selectedId;
  return !!sel && sel.kind === 'row' && sel.id === props.row.id;
});

/* ----- makeDroppable wiring ---------------------------------------- */
/*
 *   `disabled` is a reactive ref so toggling editable on/off (e.g. via
 *   the toolbar) flips the row's droppability without remounting.
 *
 *   `groups: ['section']` — palette tiles + section instances share
 *   this group; cross-feature drags (theme tokens etc) won't accidentally
 *   land here.
 *
 *   `payload: () => props.row.sections` — dnd-kit's payload factory.
 *   Called per drag-tick so it always reads the LIVE sections array.
 *
 *   `isDragOver: ComputedRef<IPlacement | undefined>` — bound to a
 *   --over modifier class in commit G (drop indicator visuals).
 */
const rowRef = ref<HTMLElement | null>(null);
const dragDisabled = computed<boolean>(() => !props.editable);
const announcer = useLayoutAnnouncer();
const history = useLayoutHistory();

function handleDrop(event: IDragEvent): void {
  // Delegate to the pure dispatcher — same function used by tests, so
  // the behavior matrix is exercised once + this component is wiring.
  // Phase 3b/B: pass `findRow` so cross-row + cross-zone drops route
  // through the dispatcher's `'moved'` branch instead of noop.
  const outcome = dispatchSectionDrop(event, props.row, { findRow: props.findRow });

  if (outcome.kind === 'inserted') {
    announcer.announce(
      narrateInserted(outcome.section.type, outcome.at, props.row.sections.length),
    );
    // Phase 3b/B: record for undo. The dispatcher already mutated the
    // row; the command captures how to invert + how to replay.
    history.record(insertSectionCommand({
      rowId: props.row.id,
      at: outcome.at,
      section: outcome.section,
      label: `insert ${outcome.section.type}`,
    }));
    return;
  }
  if (outcome.kind === 'reordered') {
    // No-op reorder (audit R2-5): drag-onto-self produces from===to.
    // Narrating "moved from position 3 to position 3" is confusing
    // and worse-than-silent for SR users. The drag still consumed
    // pointer focus, so the implicit feedback is "I held + released
    // and nothing changed". Silent is correct. Also DON'T record a
    // command — the stack would fill with self-equal entries.
    if (outcome.from === outcome.to) return;
    announcer.announce(
      narrateReordered(
        outcome.section.type,
        outcome.from,
        outcome.to,
        props.row.sections.length,
      ),
    );
    history.record(reorderSectionCommand({
      rowId: props.row.id,
      sectionId: outcome.section.id,
      from: outcome.from,
      to: outcome.to,
      label: `reorder ${outcome.section.type}`,
    }));
    return;
  }
  if (outcome.kind === 'moved') {
    // Cross-row / cross-zone — Phase 3b/B's headline feature. Narrate
    // with zone slugs when findZone is available so SR users hear the
    // destination zone explicitly ("moved from main … to sidebar …").
    // The dispatcher's `fromTotal` is the source's BEFORE-splice length;
    // `toTotal` is the destination's AFTER-insert length. Both are the
    // right numbers for "position N of M" narration after the move.
    const fromZone = props.findZone?.(outcome.fromRowId);
    const toZone = props.findZone?.(outcome.toRowId);
    if (fromZone && toZone && fromZone !== toZone) {
      announcer.announce(narrateMovedToZone(
        outcome.section.type,
        fromZone, outcome.fromIdx, outcome.fromTotal,
        toZone, outcome.toIdx, outcome.toTotal,
      ));
    } else {
      // Cross-row within the same zone (or zones unknown). Fall back to
      // the row-relative form — still position-based, just doesn't name
      // a zone the user already implicitly knew about.
      announcer.announce(narrateReordered(
        outcome.section.type,
        outcome.fromIdx,
        outcome.toIdx,
        outcome.toTotal,
      ));
    }
    history.record(moveSectionCommand({
      fromRowId: outcome.fromRowId,
      toRowId: outcome.toRowId,
      sectionId: outcome.section.id,
      fromIdx: outcome.fromIdx,
      toIdx: outcome.toIdx,
      label: `move ${outcome.section.type}`,
    }));
    return;
  }
  // noop outcomes (ghost id, empty payload) — silent so we don't narrate
  // "nothing happened" on every accidental drop. The user's pointer
  // feedback is enough.
}

/* ----- Move Up / Move Down — WCAG 2.1.1 non-drag a11y path -------- */
/*
 * Drag-drop has a notoriously bad SR story; per the editor a11y memory
 * + WCAG 2.1.1, every drag operation needs a non-drag keyboard path.
 * Move Up / Move Down buttons on each section satisfy this — the user
 * Tabs to a section, focuses one of the buttons, presses Enter.
 *
 * Bounds-check returns early with a narrateMoveBlocked announcement
 * so SR users hear WHY the press did nothing (otherwise it reads as a
 * broken control). Mutation flows through row.sections.splice → Vue
 * watcher → auto-save (same path as drag drops).
 */
function moveSection(section: LayoutSection, direction: 'up' | 'down'): void {
  const idx = props.row.sections.findIndex((s) => s.id === section.id);
  if (idx === -1) return; // section vanished mid-keypress
  const total = props.row.sections.length;
  if (direction === 'up' && idx === 0) {
    announcer.announce(narrateMoveBlocked(section.type, 'up'));
    return;
  }
  if (direction === 'down' && idx === total - 1) {
    announcer.announce(narrateMoveBlocked(section.type, 'down'));
    return;
  }
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  const [moved] = props.row.sections.splice(idx, 1);
  if (!moved) return;
  props.row.sections.splice(targetIdx, 0, moved);
  announcer.announce(narrateReordered(moved.type, idx, targetIdx, total));
  // Phase 3b/B: keyboard reorder records to undo too, so Cmd+Z works
  // identically for drag-driven + keyboard-driven moves. The command
  // captures the absolute positions (not just direction) so a redo
  // after intervening commands still lands correctly.
  history.record(reorderSectionCommand({
    rowId: props.row.id,
    sectionId: moved.id,
    from: idx,
    to: targetIdx,
    label: `move ${moved.type} ${direction}`,
  }));
}

/* ----- Move to zone … — WCAG cross-zone keyboard path -------------- */
/*
 * Per the keyboard model decision in 163-kickoff-3b-B (user-selected
 * "Move to zone..." button on each section): the popover on each
 * section lists every zone EXCEPT the current one + non-empty zones
 * only (a target zone needs a row to land on; "Add row" is a separate
 * arc).
 *
 * Landing rule: section appends to the END of the FIRST row in the
 * target zone — predictable + Notion-like "go to top of section X".
 * User can refine with Move Up/Down + drag after the move.
 *
 * Mutation matches drag's cross-row path: splice from source row,
 * push to destination, narrate via narrateMovedToZone, record a
 * moveSectionCommand for undo. One round-trip, full a11y parity.
 */
const availableZones = computed<string[]>(() => {
  if (!props.editable) return [];
  if (!props.findFirstRowInZone) return [];
  return props.zoneSlugs.filter((slug) => {
    if (slug === props.zone) return false;
    // A zone with no rows can't accept a landing target — disable.
    // (Could be enabled when "Add row" lands; defer for now.)
    return props.findFirstRowInZone!(slug) !== null;
  });
});

function moveSectionToZone(section: LayoutSection, targetZone: string): void {
  if (!props.findFirstRowInZone) return;
  const targetRow = props.findFirstRowInZone(targetZone);
  if (!targetRow) return;
  const idx = props.row.sections.findIndex((s) => s.id === section.id);
  if (idx === -1) return;
  const fromTotal = props.row.sections.length;
  const [moved] = props.row.sections.splice(idx, 1);
  if (!moved) return;
  const toIdx = targetRow.sections.length; // append
  targetRow.sections.push(moved);
  // Narrate cross-zone. `fromTotal` is the pre-splice source length;
  // `toTotal` is the post-push destination length — both 1-indexed
  // in the narration template.
  announcer.announce(narrateMovedToZone(
    moved.type,
    props.zone, idx, fromTotal,
    targetZone, toIdx, targetRow.sections.length,
  ));
  history.record(moveSectionCommand({
    fromRowId: props.row.id,
    toRowId: targetRow.id,
    sectionId: moved.id,
    fromIdx: idx,
    toIdx,
    label: `move ${moved.type} to ${targetZone}`,
  }));
}

const { isDragOver } = makeDroppable(
  rowRef,
  {
    disabled: dragDisabled,
    groups: ['section'],
    events: {
      onDrop: handleDrop,
    },
  },
  () => props.row.sections,
);

/** Exposed for the drop-indicator class binding in the template. */
const isOver = computed<boolean>(() => isDragOver.value !== undefined);
</script>

<template>
  <div
    ref="rowRef"
    class="cpub-layout-row"
    :class="{
      'cpub-layout-row--editable': editable,
      'cpub-layout-row--selected': editable && rowIsSelected,
      'cpub-layout-row--drop-over': editable && isOver,
    }"
    :data-row-id="row.id"
    :data-gap="row.config?.gap ?? 'md'"
    :data-align="row.config?.align ?? 'stretch'"
    :data-padding-y="row.config?.paddingY ?? 'none'"
    :style="row.config?.background ? { background: row.config.background } : {}"
  >
    <!--
      Section rendering delegated to <LayoutSection> so each section
      owns its own makeDraggable template ref. Same per-iteration
      reasoning as the row extraction.
    -->
    <LayoutSectionComponent
      v-for="section in row.sections.filter(sectionVisible)"
      :key="section.id"
      :section="section"
      :row-id="row.id"
      :route="route"
      :zone="zone"
      :editable="editable"
      :is-preview="isPreview"
      :on-select="onSelect"
      :selected-id="selectedId"
      :on-move-up="() => moveSection(section, 'up')"
      :on-move-down="() => moveSection(section, 'down')"
      :available-zones="availableZones"
      :on-move-to-zone="(targetZone: string) => moveSectionToZone(section, targetZone)"
    />
  </div>
</template>

<style scoped>
/*
 * Phase 3b/A extraction: the .cpub-layout-row + .cpub-layout-section
 * chrome (previously inlined in LayoutSlot.vue's <style scoped>) moves
 * here because Vue scoped styles are component-instance-hashed — rules
 * in LayoutSlot wouldn't reach the markup LayoutRow renders. Keeping
 * them here scopes them correctly to the elements they target.
 * LayoutSlot now only styles its skeleton loader + placeholder.
 */
.cpub-layout-row {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--space-4);
  width: 100%;
}
.cpub-layout-row[data-gap='none'] { gap: 0; }
.cpub-layout-row[data-gap='sm']   { gap: var(--space-2); }
.cpub-layout-row[data-gap='md']   { gap: var(--space-4); }
.cpub-layout-row[data-gap='lg']   { gap: var(--space-6); }

.cpub-layout-row[data-align='center'] { align-items: center; }
.cpub-layout-row[data-align='start']  { align-items: start; }
.cpub-layout-row[data-align='stretch'] { align-items: stretch; }

.cpub-layout-row[data-padding-y='sm'] { padding-block: var(--space-2); }
.cpub-layout-row[data-padding-y='md'] { padding-block: var(--space-4); }
.cpub-layout-row[data-padding-y='lg'] { padding-block: var(--space-6); }
.cpub-layout-row[data-padding-y='xl'] { padding-block: var(--space-8); }

/* ------------------------------------------------------------------ */
/* Editable-mode chrome — row only. Section chrome moved to            */
/* LayoutSection.vue with the section extraction.                      */
/* ------------------------------------------------------------------ */
.cpub-layout-row--editable {
  position: relative;
}
/* Audit-of-audit A2-2: gate min-height to :empty so populated rows
   size to their content (the original min-height was correct for
   empty rows but over-padded compact rows). :empty matches when the
   row has zero child elements, which happens when sections.length===0
   OR all sections are filtered out by sectionVisible. Both cases mean
   "no drop target without help" — exactly when we need to enlarge it. */
.cpub-layout-row--editable:empty {
  min-height: 64px;
}
.cpub-layout-row--editable:hover {
  outline: 1px dashed var(--border);
  outline-offset: 2px;
}

.cpub-layout-row--selected {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* ------------------------------------------------------------------ */
/* Phase 3b/A drop-target highlight. Light accent-bg flash when a      */
/* drag is over this row — sharper visual lands in commit G via the   */
/* placement-aware drop indicator. This is the baseline affordance.   */
/* ------------------------------------------------------------------ */
.cpub-layout-row--drop-over {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  outline: 2px dashed var(--accent);
  outline-offset: 4px;
}
</style>
