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
} from '../composables/useLayoutAnnouncer';
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
}>(), {
  editable: false,
  isPreview: false,
  onSelect: undefined,
  selectedId: null,
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

function handleDrop(event: IDragEvent): void {
  // Delegate to the pure dispatcher — same function used by tests, so
  // the behavior matrix is exercised once + this component is wiring.
  const outcome = dispatchSectionDrop(event, props.row);
  // Narrate the result for screen readers. `total` reflects post-drop
  // length (palette → row insert grows by 1; within-row reorder stays
  // the same).
  if (outcome.kind === 'inserted') {
    announcer.announce(
      narrateInserted(outcome.section.type, outcome.at, props.row.sections.length),
    );
  } else if (outcome.kind === 'reordered' && outcome.from !== outcome.to) {
    // No-op reorder (audit R2-5): drag-onto-self produces from===to.
    // Narrating "moved from position 3 to position 3" is confusing
    // and worse-than-silent for SR users. The drag still consumed
    // pointer focus, so the implicit feedback is "I held + released
    // and nothing changed". Silent is correct.
    announcer.announce(
      narrateReordered(
        outcome.section.type,
        outcome.from,
        outcome.to,
        props.row.sections.length,
      ),
    );
  }
  // noop outcomes (cross-row, ghost id, empty payload) — silent so
  // we don't narrate "nothing happened" on every accidental drop. The
  // user's pointer feedback is enough.
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
  /* Empty editable rows still need to be reachable as drop targets
     (audit R1/R3-2). Without min-height the row collapses to 0 height
     when sections.length===0, so dnd-kit's hit-test never matches the
     row. 64px is generous enough to be hover-discoverable + tap-
     friendly without dominating the canvas when populated. The
     :not selector means populated rows size to their content. */
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
