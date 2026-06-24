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
import type { ComputedRef } from 'vue';
import { makeDroppable, type IDragEvent, type IPlacement } from '@vue-dnd-kit/core';
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
import { useLayoutResize } from '../composables/useLayoutResize';
import { useSectionRegistry } from '../sections/registry';
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
  /**
   * Session 164 polish — remove-row handler. Editor page implements;
   * Canvas threads through. When absent, the × button is hidden.
   * The handler receives (zoneSlug, rowId) so it can locate + splice
   * + record + narrate.
   */
  onRemoveRow?: (zoneSlug: string, rowId: string) => void;
  /**
   * Phase 3c — closure threading the editor's live draft into the
   * resize composable. The row's onResizeStart needs the draft (so the
   * composable can mutate it for live preview); passing through props
   * keeps the row decoupled from useLayoutEditor (which already only
   * exists at the editor page level, NOT in LayoutSlot's public path).
   *
   * Absent on the public render path + on LayoutSlot's previewOverride
   * path → resize handles aren't rendered (parent doesn't pass an
   * onResizeStart to its sections). Plan §7.5: resize is editor-only.
   */
  getDraft?: () => import('@commonpub/server').LayoutRecord | null;
}>(), {
  editable: false,
  isPreview: false,
  onSelect: undefined,
  selectedId: null,
  findRow: undefined,
  findZone: undefined,
  zoneSlugs: () => [],
  findFirstRowInZone: undefined,
  onRemoveRow: undefined,
  getDraft: undefined,
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

/**
 * Phase 3b/B FLIP — `<TransitionGroup>` is rendered AS the row's outer
 * `<div class="cpub-layout-row">`. That preserves the byte-pattern + the
 * grid-container role + the makeDroppable ref binding. The ref on a
 * component points at the component instance, not the DOM; this setter
 * extracts `.$el` so makeDroppable's HTMLElement contract holds.
 *
 * On the public path (editable=false), the `name` prop is unset so no
 * transition CSS classes are added during the (rare) section re-renders.
 * The initial mount has no `appear` either, so the public byte-pattern
 * is unaffected.
 */
function setRowRef(el: unknown): void {
  if (!el) { rowRef.value = null; return; }
  if (typeof el === 'object' && '$el' in el) {
    rowRef.value = ((el as { $el: HTMLElement | null }).$el) ?? null;
  } else {
    rowRef.value = el as HTMLElement;
  }
}

/** Animation name — bound conditionally so the public path (editable=false)
 *  stays animation-free. */
const flipName = computed<string | undefined>(() =>
  props.editable ? 'cpub-flip' : undefined,
);

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

/* ----- Resize handle wiring (Phase 3c) -------------------------------- */
/*
 * The row owns the resize orchestration because:
 *   - rowRef is the row's DOM element → containerWidth via getBoundingClientRect
 *   - row.sections is the array we look up the right neighbour from
 *   - the registry lives at the layer level; the row already imports it
 *     for the section renderer + can use it for bounds
 *
 * The actual pointer-event listener lives on the section's right-edge
 * handle button (LayoutSection.vue). When that fires, it calls the
 * closure we pass via `onResizeStart` — which here resolves the row's
 * width, finds the neighbour, looks up bounds, then asks
 * useLayoutResize.startResize to take over with full document-level
 * pointer-event handling.
 */
const resize = useLayoutResize();
const sectionRegistry = useSectionRegistry();

function resizeHandlerForSection(section: LayoutSection): ((e: PointerEvent) => void) | undefined {
  // Public path: nothing. Same gate as the move handlers.
  if (!props.editable) return undefined;
  // Without a draft getter, the composable can't mutate live state for
  // preview — the resize would be visually inert. Skip.
  if (!props.getDraft) return undefined;
  const def = sectionRegistry.get(section.type);
  if (!def) return undefined;
  if (!def.resizable) return undefined;
  // Bind a closure capturing this section's identity + its def's bounds.
  return (e: PointerEvent) => {
    const containerEl = rowRef.value;
    if (!containerEl) return;
    const containerWidth = containerEl.getBoundingClientRect().width;
    // Find the right neighbour from the LIVE sections array — handles
    // any intervening reorders since the closure was built.
    const idx = props.row.sections.findIndex((s) => s.id === section.id);
    if (idx === -1) return;
    const neighbour = idx < props.row.sections.length - 1
      ? props.row.sections[idx + 1]
      : null;
    const neighbourDef = neighbour ? sectionRegistry.get(neighbour.type) : null;
    // Session 166 round-2 audit P1: if the neighbour is `resizable: false`,
    // the operator opted that section out of resize. Absorbing the source
    // section's delta into it would silently resize a fixed-width section
    // — contradicting the intent. Treat it as fixed: set neighbourMin to
    // its CURRENT colSpan so clampResize stops the source at the boundary.
    // (Same trick used by single-value-range sliders that want to model a
    // hard wall on one side.)
    const neighbourFixed = !!neighbour && neighbourDef?.resizable === false;
    const effectiveNeighbourMin = neighbourFixed
      ? (neighbour?.colSpan ?? 1)
      : (neighbourDef?.minColSpan ?? 1);
    resize.startResize({
      rowId: props.row.id,
      sectionId: section.id,
      sectionType: section.type,
      startColSpan: section.colSpan,
      sectionMin: def.minColSpan,
      sectionMax: def.maxColSpan,
      neighbourId: neighbour?.id ?? null,
      neighbourStartColSpan: neighbour?.colSpan ?? 0,
      neighbourMin: effectiveNeighbourMin,
      neighbourMax: neighbourDef?.maxColSpan ?? 12,
      startPointerX: e.clientX,
      pointerId: e.pointerId,
      containerWidth,
      getDraft: props.getDraft!,
      captureEl: e.currentTarget as HTMLElement,
    });
  };
}

/**
 * Should the 12-col guide overlay render? True when a resize is in
 * flight AND it targets THIS row. The overlay is a row-level affordance
 * (12 vertical lines across the full row width) so it lives here,
 * NOT in LayoutSection.
 */
const showResizeOverlay = computed<boolean>(() => {
  const s = resize.state.value;
  return s.kind === 'resizing' && s.rowId === props.row.id;
});

/** The current snap-line column to bold (1..12). Computed from the
 *  resizing section's currentColSpan + its position in the row, so the
 *  bolded line lands at the resized section's right edge. */
const snapLineCol = computed<number | null>(() => {
  const s = resize.state.value;
  if (s.kind !== 'resizing' || s.rowId !== props.row.id) return null;
  // Walk row.sections summing colSpans up to and INCLUDING the resized
  // section. That column index (1..12) is where the section's right
  // edge currently lies — which is what the handle is dragging.
  let cumulative = 0;
  for (const sec of props.row.sections) {
    cumulative += sec.colSpan;
    if (sec.id === s.sectionId) {
      // Cap at 12 — defensive against draft-corruption (sum > 12).
      return Math.min(12, cumulative);
    }
  }
  return null;
});

/* ----- Remove row — Session 164 polish -------------------------------- */
/*
 * Delegates to the editor page (which has full draft access + handles
 * the confirm dialog for non-empty rows). The row passes its own zone
 * slug + id; the editor mutates + records `removeRowCommand` + narrates.
 *
 * `hasRemoveHandler` is computed instead of inlined `editable && onRemoveRow`
 * in the template because vue-tsc strict narrows withDefaults'd optional
 * function props to "always defined" — TS2774. The computed sidesteps
 * the narrowing (matches the existing pattern for hasMoveTargets).
 * Per feedback-vue-tsc-strict-vs-vitest.
 */
const hasRemoveHandler = computed<boolean>(() => !!(props.editable && props.onRemoveRow));
function handleRemoveClick(): void {
  props.onRemoveRow?.(props.zone, props.row.id);
}

/**
 * Phase 3e — row selection. Sections had a selection trigger since 3b
 * (LayoutSection click → onSelect({kind:'section'})); rows had the
 * `--selected` class + `rowIsSelected` computed wired but NO trigger, so
 * the inspector's row branch was unreachable. A dedicated handle button
 * (mirrors the remove button, top-LEFT corner) toggles row selection —
 * a separate button rather than making the whole row clickable avoids the
 * nested-interactive ARIA violation (feedback-nested-aria-button-violation).
 * `@click.stop` keeps the click off the canvas click-outside-to-deselect.
 */
const hasSelectHandler = computed<boolean>(() => !!(props.editable && props.onSelect));
function handleRowSelectClick(): void {
  props.onSelect?.(rowIsSelected.value ? null : { kind: 'row', id: props.row.id });
}

/*
 * CRITICAL — public-path provider guard (session 169 P0 hotfix). Mirror of
 * the guard in LayoutSection.vue: `makeDroppable` injects 'VueDnDKitProvider'
 * at setup and throws "DnD provider not found" with no <DnDProvider>
 * ancestor (disabled:true does NOT suppress the inject). The public render
 * path (homepage layout canary + custom pages: <LayoutSlot editable=false>)
 * has no provider, so this crashed the page with a 500. Instantiate the
 * droppable ONLY in editable mode (always inside the editor's
 * <DnDProvider>); editable is static per instance so the conditional call
 * is safe. Public rows use an inert ComputedRef fallback (never a drop
 * target). See feedback-integration-test-full-output-path.
 */
let isDragOver: ComputedRef<IPlacement | undefined>;
if (props.editable) {
  const droppable = makeDroppable(
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
  isDragOver = droppable.isDragOver;
} else {
  isDragOver = computed(() => undefined);
}

/** Exposed for the drop-indicator class binding in the template. */
const isOver = computed<boolean>(() => isDragOver.value !== undefined);
</script>

<template>
  <!--
    Phase 3b/B: <TransitionGroup> IS the row's outer element. The grid
    container role + makeDroppable ref + selection/drop-over class set
    transfers verbatim. `tag="div"` keeps the rendered HTML identical
    to the pre-FLIP shape. `name` is unset on the public path so no
    transition CSS attaches there (initial mount has no `appear`, so
    public byte-pattern is unchanged).
  -->
  <TransitionGroup
    :ref="setRowRef"
    tag="div"
    :name="flipName"
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
      :on-resize-start="resizeHandlerForSection(section)"
    />
    <!--
      Session 164 polish, remove row × button.
      Keyed child so <TransitionGroup> tracks it (TG requires keyed
      children). The button is position:absolute on the row corner
      so it doesn't take a grid column; FLIP doesn't move it because
      its key is constant. Visible only on row hover or focus + only
      when an onRemoveRow handler is wired (public path stays clean).
    -->
    <!--
      Phase 3e, row select handle. Top-left corner so it doesn't collide
      with the top-right remove button. Toggles row selection → the
      inspector swaps to the row-config form. Keyed for TransitionGroup;
      hidden on the public path (no onSelect handler).
    -->
    <button
      v-if="hasSelectHandler"
      key="cpub-row-select"
      type="button"
      class="cpub-layout-row-select"
      :class="{ 'cpub-layout-row-select--active': rowIsSelected }"
      :aria-label="rowIsSelected ? `Row in ${zone} selected, activate to deselect` : `Select this row in ${zone}`"
      :aria-pressed="rowIsSelected"
      :title="rowIsSelected ? 'Deselect row' : 'Select row'"
      @click.stop="handleRowSelectClick"
      @keydown.space.stop.prevent="handleRowSelectClick"
      @keydown.enter.stop.prevent="handleRowSelectClick"
    >
      <i class="fa-solid fa-grip-lines" aria-hidden="true"></i>
    </button>
    <button
      v-if="hasRemoveHandler"
      key="cpub-row-remove"
      type="button"
      class="cpub-layout-row-remove"
      :aria-label="`Remove this row from ${zone}`"
      :title="`Remove this row from ${zone}`"
      @click.stop="handleRemoveClick"
      @keydown.space.stop.prevent="handleRemoveClick"
      @keydown.enter.stop.prevent="handleRemoveClick"
    >
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
    <!--
      Phase 3c, 12-col guideline overlay. Shown ONLY while a resize is
      in flight AND it's resizing a section in THIS row. 12 vertical
      lines absolutely positioned across the row's inside; the line at
      `snapLineCol` (the resized section's right edge) bolds to opacity
      0.7 so the user sees their current snap target.
      Keyed so <TransitionGroup> tracks it without animating in/out
      (constant key; v-if drives mount/unmount). pointer-events:none on
      the wrapper so the overlay can't intercept the resize gesture.
    -->
    <div
      v-if="showResizeOverlay"
      key="cpub-resize-overlay"
      class="cpub-layout-row-resize-overlay"
      aria-hidden="true"
    >
      <span
        v-for="col in 12"
        :key="col"
        class="cpub-layout-row-resize-overlay-line"
        :class="{ 'cpub-layout-row-resize-overlay-line--snap': snapLineCol === col }"
        :style="{ left: `${(col / 12) * 100}%` }"
      ></span>
    </div>
  </TransitionGroup>
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
   "no drop target without help", exactly when we need to enlarge it. */
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

/* ------------------------------------------------------------------ */
/* Session 164 — Remove row × button.                                   */
/* Hover-reveal on the row's top-right corner. Stays at opacity 0 by   */
/* default so it doesn't clutter the canvas; fades in on hover/focus.  */
/* Red on hover (destructive intent) per the design system convention. */
/* prefers-reduced-motion: skip the fade.                              */
/* ------------------------------------------------------------------ */
.cpub-layout-row-remove {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  z-index: 3;
  opacity: 0;
  transition: opacity 100ms ease-out, color var(--transition-default), border-color var(--transition-default);
  font-size: var(--text-sm);
}
.cpub-layout-row--editable:hover > .cpub-layout-row-remove,
.cpub-layout-row-remove:focus-visible,
.cpub-layout-row--selected > .cpub-layout-row-remove {
  opacity: 1;
}
.cpub-layout-row-remove:hover {
  color: var(--red-text);
  border-color: var(--red);
  background: var(--red-bg, var(--surface));
}
.cpub-layout-row-remove:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-row-remove { transition: none; }
}

/* Phase 3e — row select handle. Mirrors the remove button's reveal-on-
   hover/focus/selected behavior; positioned top-LEFT (remove is top-right)
   so both fit on a row corner without overlap. Accent (not red), it's a
   selection affordance, not destructive. */
.cpub-layout-row-select {
  position: absolute;
  top: -14px;
  left: -14px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  z-index: 3;
  opacity: 0;
  transition: opacity 100ms ease-out, color var(--transition-default), border-color var(--transition-default);
  font-size: var(--text-xs);
}
.cpub-layout-row--editable:hover > .cpub-layout-row-select,
.cpub-layout-row-select:focus-visible,
.cpub-layout-row--selected > .cpub-layout-row-select {
  opacity: 1;
}
.cpub-layout-row-select:hover,
.cpub-layout-row-select--active {
  color: var(--accent);
  border-color: var(--accent);
}
.cpub-layout-row-select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-row-select { transition: none; }
}

/* ------------------------------------------------------------------ */
/* Phase 3b/B FLIP animations — name="cpub-flip" attaches these classes */
/* during enter/leave/move. Only editable mode wires the name prop, so */
/* the public path stays animation-free.                                */
/*                                                                      */
/* Plan §7.11 (visual design system):                                   */
/*   - insertion: transform scale(0.96)→1 + opacity 0→1 over 150ms      */
/*     cubic ease-out                                                   */
/*   - removal: reverse                                                 */
/*   - reorder: FLIP — sections slide via transform from delta          */
/*                                                                      */
/* The `*-move` class is what gives reorder its visual FLIP — Vue       */
/* computes the new transform from the position delta + transitions     */
/* via the `transition` property listed below.                          */
/*                                                                      */
/* prefers-reduced-motion: `transition: none` on all three classes      */
/* disables the animation while preserving the layout mutation.         */
/* (Not display:none — we still want the section to appear in its       */
/* new location, just without the animation.)                           */
/* ------------------------------------------------------------------ */
.cpub-flip-enter-active,
.cpub-flip-leave-active {
  transition:
    opacity 150ms cubic-bezier(0.2, 0.8, 0.4, 1),
    transform 150ms cubic-bezier(0.2, 0.8, 0.4, 1);
}
.cpub-flip-enter-from,
.cpub-flip-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
/* `*-move` covers FLIP-driven reorder (Vue calculates the from→to
   transform; this transition smooths it). */
.cpub-flip-move {
  transition: transform 150ms cubic-bezier(0.2, 0.8, 0.4, 1);
}
/* When an item is leaving, its DOM stays for the duration of the
   leave transition. Take it out of the document flow so other items
   can FLIP into its space WITHOUT waiting for the leave to finish -
   gives a visually-coherent reorder when a section is also being
   removed. */
.cpub-flip-leave-active {
  position: absolute;
}
@media (prefers-reduced-motion: reduce) {
  .cpub-flip-enter-active,
  .cpub-flip-leave-active,
  .cpub-flip-move {
    transition: none;
  }
  .cpub-flip-enter-from,
  .cpub-flip-leave-to {
    /* Skip the scale/opacity prelude so reduced-motion users see the
       section appear/disappear instantly in its final state. */
    opacity: 1;
    transform: none;
  }
}

/* ------------------------------------------------------------------ */
/* Phase 3c — 12-column guideline overlay during a resize.              */
/*                                                                      */
/* Renders 12 faint vertical lines across the row's inside width; the   */
/* line at the resized section's current snap target bolds. Gives the   */
/* admin a visual frame of reference for "where will the snap land" and */
/* matches Webflow / Framer / Cursor's grid-edit affordance.            */
/*                                                                      */
/* pointer-events:none on the wrapper so the overlay can't intercept    */
/* the resize gesture. position:absolute relative to the row (which is  */
/* already position:relative in editable mode).                         */
/*                                                                      */
/* prefers-reduced-motion: opacity-in transition skipped.               */
/* ------------------------------------------------------------------ */
.cpub-layout-row-resize-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Above the section content (which is pointer-events:none anyway in
     editable mode) but below the move-buttons cluster (z=2) + the
     resize handle (z=1). Set to 0 so it sits just over content but
     under interactive chrome. The lines themselves are opaque enough
     to read against any background. */
  z-index: 0;
  /* Fade in for sighted users; reduced-motion users see it instantly. */
  animation: cpub-overlay-fade-in 100ms ease-out;
}
/* R1-7 audit fix: the overlay is a keyed child of the row's
   <TransitionGroup>, so it INHERITS the cpub-flip-enter/leave classes
   while mounting. Their opacity:0 + scale(0.96) prelude conflicts with
   the overlay's own fade-in animation, for ~150ms the overlay would
   pop to scale 0.96, then snap back. Override to neutralise the flip
   prelude on the overlay specifically; sections + the remove button
   keep their flip animations. */
.cpub-flip-enter-active.cpub-layout-row-resize-overlay,
.cpub-flip-leave-active.cpub-layout-row-resize-overlay,
.cpub-flip-move.cpub-layout-row-resize-overlay {
  transition: none;
}
.cpub-flip-enter-from.cpub-layout-row-resize-overlay,
.cpub-flip-leave-to.cpub-layout-row-resize-overlay {
  opacity: 1;
  transform: none;
}
@keyframes cpub-overlay-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.cpub-layout-row-resize-overlay-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--accent);
  opacity: 0.25;
  /* Center the line on its column boundary so the visual lands exactly
     where the snap will. */
  transform: translateX(-0.5px);
}
.cpub-layout-row-resize-overlay-line--snap {
  /* The current snap target — bold AND wider so it pops against the
     12-line backdrop. Three independent signals (color + width +
     opacity) per WCAG 1.4.1. */
  opacity: 0.85;
  width: 2px;
  transform: translateX(-1px);
}
@media (prefers-reduced-motion: reduce) {
  .cpub-layout-row-resize-overlay { animation: none; }
}
</style>
